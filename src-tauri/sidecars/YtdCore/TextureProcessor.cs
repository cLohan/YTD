using System.Text.Json;

namespace YtdCore;

public sealed class TextureProcessor
{
    public List<TextureItem> Process(
        YtdService service,
        JsonElement config,
        CancellationToken cancellationToken,
        Action<object> progress,
        Action<string, string> log)
    {
        var selectedEncoder = config.TryGetProperty("encoder", out var encoderEl)
            ? encoderEl.GetString() ?? "internal"
            : "internal";

        var outputFormat = config.TryGetProperty("output", out var outputEl) && outputEl.TryGetProperty("format", out var formatEl)
            ? formatEl.GetString() ?? "BC7_UNORM"
            : "BC7_UNORM";
        var maxQuality = config.TryGetProperty("output", out var outputQualityEl)
            && outputQualityEl.TryGetProperty("maxQuality", out var qualityEl)
            && qualityEl.GetBoolean();
        var keepOriginalMipmaps = config.TryGetProperty("output", out var outputMipEl)
            && outputMipEl.TryGetProperty("keepOriginalMipmaps", out var keepMipEl)
            && keepMipEl.GetBoolean();
        var generateMipmaps = config.TryGetProperty("output", out var outputGenEl)
            && outputGenEl.TryGetProperty("generateMipmaps", out var genMipEl)
            && genMipEl.GetBoolean();
        var configuredMipLevels = config.TryGetProperty("output", out var outputLevelsEl)
            && outputLevelsEl.TryGetProperty("mipmapLevels", out var levelsEl)
            ? Math.Max(1, levelsEl.GetInt32())
            : 1;

        var resizeMode = config.TryGetProperty("resize", out var resizeEl) && resizeEl.TryGetProperty("mode", out var modeEl)
            ? modeEl.GetString() ?? "custom"
            : "custom";

        var targetTextures = service.GetTargetTextures(config);
        var updated = new List<TextureItem>(targetTextures.Count);

        for (var i = 0; i < targetTextures.Count; i++)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var texture = targetTextures[i];
            var (targetWidth, targetHeight) = ComputeSize(texture, config, resizeMode);
            var targetMipCount = ComputeMipCount(texture, keepOriginalMipmaps, generateMipmaps, configuredMipLevels);
            var noOp = IsNoOp(texture, targetWidth, targetHeight, targetMipCount, outputFormat, selectedEncoder);

            log("INFO", $"{texture.Name}: redimensionando com modo {resizeMode}.");
            progress(new
            {
                ytd = texture.Id.Split("::")[0],
                texture = texture.Name,
                current = i + 1,
                total = targetTextures.Count,
                phase = "resizing"
            });

            log("INFO", $"{texture.Name}: codificando via {selectedEncoder} -> {outputFormat}.");

            if (noOp)
            {
                var unchanged = new TextureItem
                {
                    Id = texture.Id,
                    Name = texture.Name,
                    Width = texture.Width,
                    Height = texture.Height,
                    MipCount = texture.MipCount,
                    Format = texture.Format,
                    SizeKb = texture.SizeKb,
                    Checked = texture.Checked,
                    Excluded = texture.Excluded,
                    Status = "processed",
                    OriginalPreview = texture.OriginalPreview,
                    OptimizedPreview = texture.OriginalPreview,
                    OptimizedInfo = new OptimizedInfo
                    {
                        Width = texture.Width,
                        Height = texture.Height,
                        MipCount = texture.MipCount,
                        Format = texture.Format,
                        SizeKb = texture.SizeKb
                    }
                };
                service.UpdateTexture(unchanged);
                updated.Add(unchanged);
                progress(new
                {
                    ytd = texture.Id.Split("::")[0],
                    texture = texture.Name,
                    current = i + 1,
                    total = targetTextures.Count,
                    phase = "encoding"
                });
                continue;
            }

            if (!service.TryBuildOptimizedTexture(texture.Id, targetWidth, targetHeight, targetMipCount, out var optimizedDds, out var realW, out var realH, out var realMipCount, out var error))
            {
                var failed = new TextureItem
                {
                    Id = texture.Id,
                    Name = texture.Name,
                    Width = texture.Width,
                    Height = texture.Height,
                    MipCount = texture.MipCount,
                    Format = texture.Format,
                    SizeKb = texture.SizeKb,
                    Checked = texture.Checked,
                    Excluded = texture.Excluded,
                    Status = "error",
                    Error = error,
                    OriginalPreview = texture.OriginalPreview,
                    OptimizedPreview = texture.OptimizedPreview,
                    OptimizedInfo = texture.OptimizedInfo
                };
                service.UpdateTexture(failed);
                updated.Add(failed);
                log("ERROR", $"{texture.Name}: {error}");
                continue;
            }

            var finalDds = optimizedDds;
            var finalFormat = outputFormat;
            if (!string.Equals(selectedEncoder, "internal", StringComparison.OrdinalIgnoreCase))
            {
                if (ExternalEncoder.TryEncode(selectedEncoder, optimizedDds, outputFormat, realMipCount, maxQuality, out var encodedDds, out var encoderError))
                {
                    finalDds = encodedDds;
                }
                else
                {
                    log("WARN", $"{texture.Name}: encoder externo '{selectedEncoder}' falhou ({encoderError}). Usando internal.");
                    finalFormat = texture.Format;
                }
            }

            service.SetOptimizedTextureData(texture.Id, finalDds);

            var newSizeKb = Math.Round(Math.Max(4, finalDds.Length / 1024d), 2);
            if (string.Equals(selectedEncoder, "internal", StringComparison.OrdinalIgnoreCase) && newSizeKb > texture.SizeKb)
            {
                // Internal path can inflate compressed formats; avoid applying worse results.
                var skipped = new TextureItem
                {
                    Id = texture.Id,
                    Name = texture.Name,
                    Width = texture.Width,
                    Height = texture.Height,
                    MipCount = texture.MipCount,
                    Format = texture.Format,
                    SizeKb = texture.SizeKb,
                    Checked = texture.Checked,
                    Excluded = texture.Excluded,
                    Status = "ready",
                    OriginalPreview = texture.OriginalPreview,
                    OptimizedPreview = texture.OptimizedPreview,
                    OptimizedInfo = texture.OptimizedInfo
                };
                service.UpdateTexture(skipped);
                updated.Add(skipped);
                log("WARN", $"{texture.Name}: otimização interna descartada (resultado maior: {newSizeKb:0.##}KB > {texture.SizeKb:0.##}KB).");
                continue;
            }

            var optimized = new TextureItem
            {
                Id = texture.Id,
                Name = texture.Name,
                Width = texture.Width,
                Height = texture.Height,
                MipCount = texture.MipCount,
                Format = texture.Format,
                SizeKb = texture.SizeKb,
                Checked = texture.Checked,
                Excluded = texture.Excluded,
                Status = "processed",
                OriginalPreview = texture.OriginalPreview,
                OptimizedPreview = YtdService.BuildOptimizedPreviewBase64(finalDds, texture.Name, realW, realH),
                OptimizedInfo = new OptimizedInfo
                {
                    Width = realW,
                    Height = realH,
                    MipCount = realMipCount,
                    Format = finalFormat,
                    SizeKb = newSizeKb
                }
            };

            service.UpdateTexture(optimized);
            updated.Add(optimized);

            progress(new
            {
                ytd = texture.Id.Split("::")[0],
                texture = texture.Name,
                current = i + 1,
                total = targetTextures.Count,
                phase = "encoding"
            });
        }

        progress(new
        {
            ytd = targetTextures.FirstOrDefault()?.Id.Split("::")[0] ?? string.Empty,
            texture = "",
            current = targetTextures.Count,
            total = targetTextures.Count,
            phase = "completed"
        });

        return updated;
    }

    private static (int width, int height) ComputeSize(TextureItem texture, JsonElement config, string resizeMode)
    {
        if (resizeMode == "keep")
        {
            return (texture.Width, texture.Height);
        }

        if (resizeMode == "percent")
        {
            var percentage = config.TryGetProperty("resize", out var resizeEl) && resizeEl.TryGetProperty("percentage", out var percEl)
                ? Math.Clamp(percEl.GetInt32(), 10, 100)
                : 50;
            var width = Math.Max(1, texture.Width * percentage / 100);
            var height = Math.Max(1, texture.Height * percentage / 100);
            return (width, height);
        }

        var customWidth = config.TryGetProperty("resize", out var customEl) && customEl.TryGetProperty("width", out var widthEl)
            ? Math.Max(1, widthEl.GetInt32())
            : texture.Width;

        var customHeight = config.TryGetProperty("resize", out var customEl2) && customEl2.TryGetProperty("height", out var heightEl)
            ? Math.Max(1, heightEl.GetInt32())
            : texture.Height;

        var keepAspect = config.TryGetProperty("resize", out var customEl3)
            && customEl3.TryGetProperty("keepAspectRatio", out var keepAspectEl)
            && keepAspectEl.GetBoolean();
        var threshold = config.TryGetProperty("resize", out var customEl4)
            && customEl4.TryGetProperty("minFilterThreshold", out var thresholdEl)
            ? thresholdEl.GetString() ?? "none"
            : "none";

        if (!PassesThreshold(texture.Width, texture.Height, threshold))
        {
            return (texture.Width, texture.Height);
        }

        // Never upscale on custom mode during optimization.
        customWidth = Math.Min(customWidth, texture.Width);
        customHeight = Math.Min(customHeight, texture.Height);

        if (!keepAspect)
        {
            return (Math.Max(1, customWidth), Math.Max(1, customHeight));
        }

        var scaleX = customWidth / (double)Math.Max(1, texture.Width);
        var scaleY = customHeight / (double)Math.Max(1, texture.Height);
        var scale = Math.Min(1d, Math.Min(scaleX, scaleY));
        var scaledWidth = Math.Max(1, (int)Math.Round(texture.Width * scale));
        var scaledHeight = Math.Max(1, (int)Math.Round(texture.Height * scale));
        return (scaledWidth, scaledHeight);
    }

    private static bool PassesThreshold(int width, int height, string threshold)
    {
        if (string.IsNullOrWhiteSpace(threshold) || threshold.Equals("none", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var parts = threshold.Split('x', 'X', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length != 2)
        {
            return true;
        }

        if (!int.TryParse(parts[0], out var minW) || !int.TryParse(parts[1], out var minH))
        {
            return true;
        }

        return width >= minW && height >= minH;
    }

    private static int ComputeMipCount(TextureItem texture, bool keepOriginalMipmaps, bool generateMipmaps, int configuredMipLevels)
    {
        if (keepOriginalMipmaps)
        {
            return Math.Max(1, texture.MipCount);
        }

        if (!generateMipmaps)
        {
            return 1;
        }

        return Math.Max(1, configuredMipLevels);
    }

    private static bool IsNoOp(TextureItem texture, int targetWidth, int targetHeight, int targetMipCount, string outputFormat, string selectedEncoder)
    {
        var sameSize = targetWidth == texture.Width && targetHeight == texture.Height;
        var sameMip = targetMipCount == Math.Max(1, texture.MipCount);
        var currentFormat = NormalizeFormat(texture.Format);
        var targetFormat = NormalizeFormat(outputFormat);
        var sameFormat = currentFormat == targetFormat || string.IsNullOrEmpty(targetFormat) || targetFormat == "AUTO";
        if (string.Equals(selectedEncoder, "internal", StringComparison.OrdinalIgnoreCase) && sameSize && sameMip)
        {
            // Internal path currently rebuilds via RGBA DDS; avoid pointless recode and file inflation.
            return true;
        }
        return sameSize && sameMip && sameFormat;
    }

    private static string NormalizeFormat(string value)
    {
        return (value ?? string.Empty)
            .Trim()
            .ToUpperInvariant()
            .Replace("D3DFMT_", string.Empty)
            .Replace("DXGI_FORMAT_", string.Empty);
    }
}
