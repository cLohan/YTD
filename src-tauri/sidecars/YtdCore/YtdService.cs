using System.Collections.Concurrent;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
using CodeWalker.GameFiles;
using CodeWalker.Utils;

namespace YtdCore;

public sealed class YtdService
{
    private readonly ConcurrentDictionary<string, YtdFileItem> _ytds = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, YtdFile> _nativeYtds = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, byte[]> _optimizedDds = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, string> _renamedTextureIds = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, string> _renamedTextureIdsReverse = new(StringComparer.OrdinalIgnoreCase);
    private readonly ConcurrentDictionary<string, byte> _removedTextureIds = new(StringComparer.OrdinalIgnoreCase);

    public List<YtdFileItem> Open(List<string> paths)
    {
        var result = new List<YtdFileItem>();

        foreach (var rawPath in paths)
        {
            var path = NormalizePath(rawPath);
            if (!File.Exists(path))
            {
                continue;
            }

            var item = BuildYtd(path);
            _ytds[item.Id] = item;
            result.Add(item);
        }

        return result;
    }

    public List<YtdFileItem> GetAll() => _ytds.Values.OrderBy(v => v.Name).ToList();

    public string GetPreview(string ytdId, string textureId, bool optimized)
    {
        if (!_ytds.TryGetValue(ytdId, out var ytd))
        {
            return string.Empty;
        }

        var texture = ytd.Textures.FirstOrDefault(t => t.Id.Equals(textureId, StringComparison.OrdinalIgnoreCase));
        if (texture is null)
        {
            return string.Empty;
        }

        if (optimized && !string.IsNullOrWhiteSpace(texture.OptimizedPreview))
        {
            return texture.OptimizedPreview;
        }

        return texture.OriginalPreview ?? string.Empty;
    }

    public List<TextureItem> GetTargetTextures(JsonElement config)
    {
        var processMode = config.TryGetProperty("mode", out var processModeElement) ? processModeElement.GetString() ?? string.Empty : string.Empty;
        var singleYtdId = config.TryGetProperty("ytdId", out var singleYtdElement) ? singleYtdElement.GetString() ?? string.Empty : string.Empty;
        var singleTextureId = config.TryGetProperty("textureId", out var singleTextureElement) ? singleTextureElement.GetString() ?? string.Empty : string.Empty;
        var mode = config.TryGetProperty("scopeMode", out var modeElement) ? modeElement.GetString() ?? "selected" : "selected";
        var ytdId = config.TryGetProperty("scopeYtdId", out var ytdElement) ? ytdElement.GetString() ?? string.Empty : string.Empty;

        var all = _ytds.Values.SelectMany(y => y.Textures.Select(t => (y, t))).ToList();

        if (string.Equals(processMode, "single-texture", StringComparison.OrdinalIgnoreCase))
        {
            return all
                .Where(item => item.y.Id.Equals(singleYtdId, StringComparison.OrdinalIgnoreCase) &&
                               item.t.Id.Equals(singleTextureId, StringComparison.OrdinalIgnoreCase) &&
                               !item.t.Excluded)
                .Select(item => item.t)
                .ToList();
        }
        if (string.Equals(processMode, "all", StringComparison.OrdinalIgnoreCase))
        {
            return all.Select(item => item.t).Where(t => !t.Excluded).ToList();
        }
        if (string.Equals(processMode, "selected", StringComparison.OrdinalIgnoreCase))
        {
            return all.Select(item => item.t).Where(t => t.Checked && !t.Excluded).ToList();
        }

        return mode switch
        {
            "all" => all.Select(item => item.t).Where(t => !t.Excluded).ToList(),
            "single-ytd" => all.Where(item => item.y.Id.Equals(ytdId, StringComparison.OrdinalIgnoreCase)).Select(item => item.t).Where(t => !t.Excluded).ToList(),
            _ => all.Select(item => item.t).Where(t => t.Checked && !t.Excluded).ToList()
        };
    }

    public void UpdateTexture(TextureItem updated)
    {
        var ytdId = updated.Id.Split("::")[0];
        if (!_ytds.TryGetValue(ytdId, out var ytd))
        {
            return;
        }

        var index = ytd.Textures.FindIndex(t => t.Id.Equals(updated.Id, StringComparison.OrdinalIgnoreCase));
        if (index >= 0)
        {
            ytd.Textures[index] = updated;
            ytd.ProcessedCount = ytd.Textures.Count(t => t.Status == "processed");
        }
    }

    public TextureItem RenameTexture(string ytdId, string textureId, string newName)
    {
        if (string.IsNullOrWhiteSpace(newName))
        {
            throw new InvalidOperationException("Nome invalido.");
        }

        if (!_ytds.TryGetValue(ytdId, out var ytd))
        {
            throw new InvalidOperationException("YTD nao encontrado.");
        }

        var nextName = newName.Trim();
        if (nextName.Contains("::", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Nome invalido.");
        }

        if (ytd.Textures.Any(t => t.Name.Equals(nextName, StringComparison.OrdinalIgnoreCase) && !t.Id.Equals(textureId, StringComparison.OrdinalIgnoreCase)))
        {
            throw new InvalidOperationException("Ja existe textura com este nome.");
        }

        var index = ytd.Textures.FindIndex(t => t.Id.Equals(textureId, StringComparison.OrdinalIgnoreCase));
        if (index < 0)
        {
            throw new InvalidOperationException("Textura nao encontrada.");
        }

        var current = ytd.Textures[index];
        var nextId = $"{ytdId}::{nextName}";
        var renamed = new TextureItem
        {
            Id = nextId,
            Name = nextName,
            Width = current.Width,
            Height = current.Height,
            MipCount = current.MipCount,
            Format = current.Format,
            SizeKb = current.SizeKb,
            Checked = current.Checked,
            Excluded = current.Excluded,
            Status = current.Status,
            Error = current.Error,
            OriginalPreview = current.OriginalPreview,
            OptimizedPreview = current.OptimizedPreview,
            OptimizedInfo = current.OptimizedInfo
        };

        ytd.Textures[index] = renamed;
        ytd.ProcessedCount = ytd.Textures.Count(t => t.Status == "processed");

        _renamedTextureIds[textureId] = nextId;
        _renamedTextureIdsReverse[nextId] = textureId;

        if (_optimizedDds.TryRemove(textureId, out var optimizedBytes))
        {
            _optimizedDds[nextId] = optimizedBytes;
        }

        if (_nativeYtds.TryGetValue(ytdId, out var nativeYtd))
        {
            var oldName = textureId.Split("::").Skip(1).FirstOrDefault() ?? current.Name;
            var nativeTexture = FindTextureByName(nativeYtd, oldName);
            if (nativeTexture is not null)
            {
                nativeTexture.Name = nextName;
                nativeTexture.NameHash = JenkHash.GenHash(nextName);
            }
        }

        return renamed;
    }

    public void RemoveTexture(string ytdId, string textureId)
    {
        if (!_ytds.TryGetValue(ytdId, out var ytd))
        {
            throw new InvalidOperationException("YTD nao encontrado.");
        }

        var index = ytd.Textures.FindIndex(t => t.Id.Equals(textureId, StringComparison.OrdinalIgnoreCase));
        if (index < 0)
        {
            throw new InvalidOperationException("Textura nao encontrada.");
        }

        var removed = ytd.Textures[index];
        ytd.Textures.RemoveAt(index);
        ytd.ProcessedCount = ytd.Textures.Count(t => t.Status == "processed");

        var originalId = _renamedTextureIdsReverse.TryGetValue(textureId, out var oldId) ? oldId : textureId;
        var renamedId = _renamedTextureIds.TryGetValue(originalId, out var newId) ? newId : textureId;

        _optimizedDds.TryRemove(textureId, out _);
        _optimizedDds.TryRemove(originalId, out _);
        _optimizedDds.TryRemove(renamedId, out _);
        _renamedTextureIds.TryRemove(originalId, out _);
        _renamedTextureIdsReverse.TryRemove(renamedId, out _);
        _removedTextureIds[originalId] = 1;
        _removedTextureIds[renamedId] = 1;
    }

    public void ExportTexture(string ytdId, string textureId, bool optimized, string format, string outputPath)
    {
        if (string.IsNullOrWhiteSpace(outputPath))
        {
            throw new InvalidOperationException("Caminho de saida invalido.");
        }

        var normalizedFormat = format.Trim().ToLowerInvariant();
        if (normalizedFormat != "dds" && normalizedFormat != "png")
        {
            throw new InvalidOperationException("Formato invalido. Use dds ou png.");
        }

        Directory.CreateDirectory(Path.GetDirectoryName(outputPath) ?? Environment.CurrentDirectory);

        if (optimized)
        {
            var bytes = GetOptimizedDds(textureId);
            if (bytes is null)
            {
                throw new InvalidOperationException("Textura ainda nao foi otimizada.");
            }

            if (normalizedFormat == "dds")
            {
                File.WriteAllBytes(outputPath, bytes);
                return;
            }

            var optimizedTexture = DDSIO.GetTexture(bytes);
            if (optimizedTexture is null)
            {
                throw new InvalidOperationException("Falha ao reconstruir textura otimizada.");
            }
            SaveTextureAsPng(optimizedTexture, outputPath);
            return;
        }

        var nativeTexture = FindNativeTextureById(ytdId, textureId) ?? throw new InvalidOperationException("Textura original nao encontrada.");
        if (normalizedFormat == "dds")
        {
            var dds = DDSIO.GetDDSFile(nativeTexture);
            if (dds is null || dds.Length == 0)
            {
                throw new InvalidOperationException("Nao foi possivel exportar DDS original.");
            }
            File.WriteAllBytes(outputPath, dds);
            return;
        }

        SaveTextureAsPng(nativeTexture, outputPath);
    }

    public bool TryBuildOptimizedTexture(string textureId, int targetWidth, int targetHeight, int targetMipLevels, out byte[] optimizedDds, out int width, out int height, out int mipCount, out string error)
    {
        optimizedDds = Array.Empty<byte>();
        width = 0;
        height = 0;
        mipCount = 1;
        error = string.Empty;

        var split = textureId.Split("::");
        if (split.Length < 2)
        {
            error = "ID de textura invalido.";
            return false;
        }

        var ytdId = split[0];
        var nativeTexture = FindNativeTextureById(ytdId, textureId);
        if (nativeTexture is null)
        {
            error = "Textura original nao encontrada.";
            return false;
        }

        try
        {
            var sourceWidth = Math.Max(1, (int)nativeTexture.Width);
            var sourceHeight = Math.Max(1, (int)nativeTexture.Height);
            var pixels = DDSIO.GetPixels(nativeTexture, 0);
            var expected = sourceWidth * sourceHeight * 4;
            if (pixels is null || pixels.Length < expected)
            {
                error = "Pixels da textura nao disponiveis.";
                return false;
            }

            using var sourceBitmap = BuildBitmapFromPixels(pixels, sourceWidth, sourceHeight);
            using var resized = new Bitmap(Math.Max(1, targetWidth), Math.Max(1, targetHeight), PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(resized))
            {
                g.CompositingMode = CompositingMode.SourceCopy;
                g.CompositingQuality = CompositingQuality.HighQuality;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.SmoothingMode = SmoothingMode.HighQuality;
                g.DrawImage(sourceBitmap, new Rectangle(0, 0, resized.Width, resized.Height), new Rectangle(0, 0, sourceBitmap.Width, sourceBitmap.Height), GraphicsUnit.Pixel);
            }

            optimizedDds = BuildRgba8Dds(resized, targetMipLevels, out var realMipCount);
            width = resized.Width;
            height = resized.Height;
            mipCount = realMipCount;
            return true;
        }
        catch (Exception ex)
        {
            error = ex.Message;
            return false;
        }
    }

    public void SetOptimizedTextureData(string textureId, byte[] optimizedDds)
    {
        _optimizedDds[textureId] = optimizedDds;
    }

    public object Save(JsonElement config)
    {
        var mode = config.TryGetProperty("mode", out var modeEl) ? modeEl.GetString() ?? "suffix" : "suffix";
        var createBackup = config.TryGetProperty("createBackup", out var backupEl) && backupEl.GetBoolean();
        var exportCsv = config.TryGetProperty("exportCsv", out var csvEl) && csvEl.GetBoolean();
        var outputDir = config.TryGetProperty("outputDir", out var outputEl) ? outputEl.GetString() ?? string.Empty : string.Empty;
        var customFileName = config.TryGetProperty("customFileName", out var customNameEl) ? customNameEl.GetString() ?? string.Empty : string.Empty;

        var saved = new List<string>();
        var csvReports = new List<string>();
        var backupFiles = new List<string>();
        var totalYtds = _ytds.Count;

        foreach (var ytd in _ytds.Values)
        {
            var targetPath = ResolveTargetPath(ytd.Path, mode, outputDir, customFileName, totalYtds);
            var optimizedBytes = BuildSavedYtdBytes(ytd);
            if (optimizedBytes is null || optimizedBytes.Length == 0)
            {
                throw new InvalidOperationException($"Falha ao montar YTD otimizado: {ytd.Name}");
            }

            if (createBackup && File.Exists(ytd.Path))
            {
                var backupPath = AllocateFile(Path.Combine(GetAppExportRoot("backups"), $"{Path.GetFileNameWithoutExtension(ytd.Path)}.bak"));
                File.Copy(ytd.Path, backupPath, overwrite: false);
                backupFiles.Add(backupPath);
            }

            Directory.CreateDirectory(Path.GetDirectoryName(targetPath) ?? Environment.CurrentDirectory);
            File.WriteAllBytes(targetPath, optimizedBytes);
            saved.Add(targetPath);

            if (exportCsv)
            {
                var csvPath = AllocateFile(Path.Combine(GetAppExportRoot("reports"), $"{Path.GetFileNameWithoutExtension(targetPath)}.csv"));
                File.WriteAllText(csvPath, BuildCsvReport(ytd), Encoding.UTF8);
                csvReports.Add(csvPath);
            }
        }

        return new { saved, csvReports, backupFiles };
    }

    private static string ResolveTargetPath(string sourcePath, string mode, string outputDir, string customFileName, int totalYtds)
    {
        if (mode == "overwrite")
        {
            return sourcePath;
        }

        if (mode == "custom" && !string.IsNullOrWhiteSpace(outputDir))
        {
            if (totalYtds == 1 && !string.IsNullOrWhiteSpace(customFileName))
            {
                var fileName = customFileName.EndsWith(".ytd", StringComparison.OrdinalIgnoreCase) ? customFileName : $"{customFileName}.ytd";
                return Path.Combine(outputDir, fileName);
            }
            return Path.Combine(outputDir, Path.GetFileName(sourcePath));
        }

        var name = Path.GetFileNameWithoutExtension(sourcePath);
        var dir = Path.GetDirectoryName(sourcePath) ?? Environment.CurrentDirectory;
        return Path.Combine(dir, $"{name}_optimized.ytd");
    }

    private byte[] BuildSavedYtdBytes(YtdFileItem ytd)
    {
        var originalBytes = File.ReadAllBytes(ytd.Path);
        var working = new YtdFile
        {
            Name = ytd.Name,
            FilePath = ytd.Path
        };
        working.Load(originalBytes);

        var texturesPointerList = working.TextureDict?.Textures;
        if (texturesPointerList is null || texturesPointerList.Count == 0)
        {
            return originalBytes;
        }

        var rebuilt = new List<Texture>(texturesPointerList.Count);
        for (var i = 0; i < texturesPointerList.Count; i++)
        {
            var current = texturesPointerList[i];
            if (current is null)
            {
                continue;
            }

            var currentId = $"{ytd.Path}::{current.Name}";
            var finalId = _renamedTextureIds.TryGetValue(currentId, out var renamedId) ? renamedId : currentId;
            var finalName = finalId.Split("::").Skip(1).FirstOrDefault() ?? current.Name;
            if (_removedTextureIds.ContainsKey(currentId) || _removedTextureIds.ContainsKey(finalId))
            {
                continue;
            }

            Texture finalTexture = current;
            var optimized = GetOptimizedDds(finalId) ?? GetOptimizedDds(currentId);
            if (optimized is not null && optimized.Length > 0)
            {
                var rebuiltTexture = DDSIO.GetTexture(optimized);
                if (rebuiltTexture is not null)
                {
                    rebuiltTexture.Name = finalName;
                    rebuiltTexture.NameHash = JenkHash.GenHash(finalName);
                    finalTexture = rebuiltTexture;
                }
            }
            else if (!string.Equals(finalName, current.Name, StringComparison.OrdinalIgnoreCase))
            {
                current.Name = finalName;
                current.NameHash = JenkHash.GenHash(finalName);
            }

            rebuilt.Add(finalTexture);
        }

        working.TextureDict?.BuildFromTextureList(rebuilt);
        return working.Save();
    }

    private string GetAppExportRoot(string folder)
    {
        var root = Path.Combine(AppContext.BaseDirectory, "exports", folder);
        Directory.CreateDirectory(root);
        return root;
    }

    private static string AllocateFile(string desiredPath)
    {
        if (!File.Exists(desiredPath))
        {
            return desiredPath;
        }

        var dir = Path.GetDirectoryName(desiredPath) ?? Environment.CurrentDirectory;
        var name = Path.GetFileNameWithoutExtension(desiredPath);
        var ext = Path.GetExtension(desiredPath);
        var n = 1;
        while (true)
        {
            var candidate = Path.Combine(dir, $"{name}_{n}{ext}");
            if (!File.Exists(candidate))
            {
                return candidate;
            }
            n++;
        }
    }

    private static string BuildCsvReport(YtdFileItem ytd)
    {
        var sb = new StringBuilder();
        sb.AppendLine("ytd,texture,status,excluded,original_width,original_height,optimized_width,optimized_height,original_format,optimized_format,original_size_kb,optimized_size_kb,delta_percent");

        foreach (var texture in ytd.Textures)
        {
            var optimized = texture.OptimizedInfo;
            var optimizedSize = optimized?.SizeKb ?? texture.SizeKb;
            var deltaPercent = texture.SizeKb > 0
                ? Math.Round(((optimizedSize - texture.SizeKb) / texture.SizeKb) * 100d, 2)
                : 0d;

            sb.Append(CsvEscape(ytd.Name)).Append(',');
            sb.Append(CsvEscape(texture.Name)).Append(',');
            sb.Append(CsvEscape(texture.Status)).Append(',');
            sb.Append(texture.Excluded ? "true" : "false").Append(',');
            sb.Append(texture.Width).Append(',');
            sb.Append(texture.Height).Append(',');
            sb.Append(optimized?.Width ?? texture.Width).Append(',');
            sb.Append(optimized?.Height ?? texture.Height).Append(',');
            sb.Append(CsvEscape(texture.Format)).Append(',');
            sb.Append(CsvEscape(optimized?.Format ?? texture.Format)).Append(',');
            sb.Append(texture.SizeKb.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
            sb.Append(optimizedSize.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture)).Append(',');
            sb.Append(deltaPercent.ToString("0.##", System.Globalization.CultureInfo.InvariantCulture));
            sb.AppendLine();
        }

        return sb.ToString();
    }

    private static string CsvEscape(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "\"\"";
        }

        var escaped = value.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }

    private YtdFileItem BuildYtd(string path)
    {
        foreach (var key in _removedTextureIds.Keys.Where(k => k.StartsWith($"{path}::", StringComparison.OrdinalIgnoreCase)).ToList())
        {
            _removedTextureIds.TryRemove(key, out _);
        }
        var bytes = File.ReadAllBytes(path);
        var ytd = new YtdFile
        {
            Name = Path.GetFileName(path),
            FilePath = path
        };
        ytd.Load(bytes);

        _nativeYtds[path] = ytd;

        var textures = new List<TextureItem>();
        var textureList = ytd.TextureDict?.Textures;
        if (textureList is not null)
        {
            for (var i = 0; i < textureList.Count; i++)
            {
                var texture = textureList[i];
                if (texture is null)
                {
                    continue;
                }

                var name = string.IsNullOrWhiteSpace(texture.Name)
                    ? $"tex_{texture.NameHash:x8}"
                    : texture.Name;

                var width = Math.Max(1, (int)texture.Width);
                var height = Math.Max(1, (int)texture.Height);
                var sizeKb = EstimateTextureSizeKb(texture, width, height);
                var mipCount = GetMipCount(texture, width, height);
                var excluded = name.EndsWith("_bump", StringComparison.OrdinalIgnoreCase);
                var textureId = $"{path}::{name}";

                textures.Add(new TextureItem
                {
                    Id = textureId,
                    Name = name,
                    Width = width,
                    Height = height,
                    MipCount = mipCount,
                    Format = texture.Format.ToString(),
                    SizeKb = sizeKb,
                    Checked = !excluded,
                    Excluded = excluded,
                    Status = excluded ? "excluded" : "ready",
                    OriginalPreview = BuildTexturePreviewBase64(texture, name, width, height)
                });
            }
        }

        return new YtdFileItem
        {
            Id = path,
            Path = path,
            Name = Path.GetFileName(path),
            Expanded = true,
            Checked = true,
            ProcessedCount = 0,
            Textures = textures
        };
    }

    private Texture? FindNativeTextureById(string ytdId, string textureId)
    {
        if (!_nativeYtds.TryGetValue(ytdId, out var ytd))
        {
            return null;
        }

        var name = textureId.Split("::").Skip(1).FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(name))
        {
            var direct = FindTextureByName(ytd, name);
            if (direct is not null)
            {
                return direct;
            }
        }

        if (_renamedTextureIdsReverse.TryGetValue(textureId, out var oldTextureId))
        {
            var oldName = oldTextureId.Split("::").Skip(1).FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(oldName))
            {
                return FindTextureByName(ytd, oldName);
            }
        }

        return null;
    }

    private static Texture? FindTextureByName(YtdFile ytd, string name)
    {
        var list = ytd.TextureDict?.Textures;
        if (list is null)
        {
            return null;
        }

        for (var i = 0; i < list.Count; i++)
        {
            var texture = list[i];
            if (texture is null)
            {
                continue;
            }

            if (texture.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
            {
                return texture;
            }
        }

        return null;
    }

    private byte[]? GetOptimizedDds(string textureId)
    {
        if (_optimizedDds.TryGetValue(textureId, out var bytes))
        {
            return bytes;
        }
        return null;
    }

    private static string NormalizePath(string path)
    {
        var normalized = path.Trim();
        if (normalized.StartsWith("file:///", StringComparison.OrdinalIgnoreCase))
        {
            return new Uri(normalized).LocalPath;
        }

        if (normalized.StartsWith("\\\\?\\", StringComparison.OrdinalIgnoreCase))
        {
            return normalized[4..];
        }

        return normalized;
    }

    private static double EstimateTextureSizeKb(Texture texture, int width, int height)
    {
        try
        {
            var dds = DDSIO.GetDDSFile(texture);
            if (dds is { Length: > 0 })
            {
                return Math.Round(dds.Length / 1024d, 2);
            }
        }
        catch
        {
            // ignore and fallback
        }

        return Math.Round(Math.Max(4d, width * height * 0.0008), 2);
    }

    private static string BuildTexturePreviewBase64(Texture texture, string label, int width, int height)
    {
        try
        {
            var pixels = DDSIO.GetPixels(texture, 0);
            var expected = width * height * 4;
            if (pixels is null || pixels.Length < expected)
            {
                return BuildPreviewBase64(label, width, height, false);
            }

            var hasNonZeroAlpha = false;
            for (var i = 3; i < expected; i += 4)
            {
                if (pixels[i] != 0)
                {
                    hasNonZeroAlpha = true;
                    break;
                }
            }
            if (!hasNonZeroAlpha)
            {
                for (var i = 3; i < expected; i += 4)
                {
                    pixels[i] = 255;
                }
            }

            using var bitmap = BuildBitmapFromPixels(pixels, width, height);
            using var ms = new MemoryStream();
            bitmap.Save(ms, ImageFormat.Png);
            return Convert.ToBase64String(ms.ToArray());
        }
        catch
        {
            return BuildPreviewBase64(label, width, height, false);
        }
    }

    internal static string BuildOptimizedPreviewBase64(byte[] ddsBytes, string label, int width, int height)
    {
        try
        {
            var rebuilt = DDSIO.GetTexture(ddsBytes);
            if (rebuilt is null)
            {
                return BuildPreviewBase64(label, width, height, true);
            }
            var realWidth = Math.Max(1, (int)rebuilt.Width);
            var realHeight = Math.Max(1, (int)rebuilt.Height);
            return BuildTexturePreviewBase64(rebuilt, label, realWidth, realHeight);
        }
        catch
        {
            return BuildPreviewBase64(label, width, height, true);
        }
    }

    private static Bitmap BuildBitmapFromPixels(byte[] pixels, int width, int height)
    {
        var bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb);
        var rect = new Rectangle(0, 0, width, height);
        var data = bitmap.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);

        try
        {
            var sourceRowSize = width * 4;
            if (data.Stride == sourceRowSize)
            {
                Marshal.Copy(pixels, 0, data.Scan0, width * height * 4);
            }
            else
            {
                for (var y = 0; y < height; y++)
                {
                    Marshal.Copy(pixels, y * sourceRowSize, data.Scan0 + (y * data.Stride), sourceRowSize);
                }
            }
        }
        finally
        {
            bitmap.UnlockBits(data);
        }

        return bitmap;
    }

    private static void SaveTextureAsPng(Texture texture, string outputPath)
    {
        var width = Math.Max(1, (int)texture.Width);
        var height = Math.Max(1, (int)texture.Height);
        var pixels = DDSIO.GetPixels(texture, 0);
        if (pixels is null || pixels.Length < width * height * 4)
        {
            throw new InvalidOperationException("Nao foi possivel ler pixels da textura.");
        }

        using var bitmap = BuildBitmapFromPixels(pixels, width, height);
        bitmap.Save(outputPath, ImageFormat.Png);
    }

    private static byte[] BuildRgba8Dds(Bitmap bitmap, int requestedMipLevels, out int actualMipLevels)
    {
        var width = bitmap.Width;
        var height = bitmap.Height;
        var pitch = width * 4;
        var maxPossible = 1;
        var w = width;
        var h = height;
        while (w > 1 || h > 1)
        {
            w = Math.Max(1, w / 2);
            h = Math.Max(1, h / 2);
            maxPossible++;
        }
        actualMipLevels = Math.Clamp(Math.Max(1, requestedMipLevels), 1, maxPossible);
        var mipData = BuildMipChain(bitmap, actualMipLevels);
        var totalBytes = mipData.Sum(item => item.Length);

        var header = new byte[128];
        Encoding.ASCII.GetBytes("DDS ").CopyTo(header, 0);
        WriteUInt32(header, 4, 124);
        WriteUInt32(header, 8, 0x0002100F); // CAPS | HEIGHT | WIDTH | PITCH | PIXELFORMAT
        WriteUInt32(header, 12, (uint)height);
        WriteUInt32(header, 16, (uint)width);
        WriteUInt32(header, 20, (uint)pitch);
        WriteUInt32(header, 28, (uint)actualMipLevels);

        WriteUInt32(header, 76, 32); // pixel format size
        WriteUInt32(header, 80, 0x00000041); // DDPF_RGB | DDPF_ALPHAPIXELS
        WriteUInt32(header, 88, 32); // bit count
        WriteUInt32(header, 92, 0x00ff0000); // R mask
        WriteUInt32(header, 96, 0x0000ff00); // G mask
        WriteUInt32(header, 100, 0x000000ff); // B mask
        WriteUInt32(header, 104, 0xff000000); // A mask

        WriteUInt32(header, 108, actualMipLevels > 1 ? 0x401008u : 0x1000u);

        var output = new byte[header.Length + totalBytes];
        Buffer.BlockCopy(header, 0, output, 0, header.Length);
        var offset = header.Length;
        foreach (var level in mipData)
        {
            Buffer.BlockCopy(level, 0, output, offset, level.Length);
            offset += level.Length;
        }
        return output;
    }

    private static List<byte[]> BuildMipChain(Bitmap source, int levels)
    {
        var result = new List<byte[]>(levels);
        var current = CloneAsArgb(source);
        try
        {
            for (var i = 0; i < levels; i++)
            {
                result.Add(ExtractBgraBytes(current));
                if (i >= levels - 1)
                {
                    break;
                }

                var nextWidth = Math.Max(1, current.Width / 2);
                var nextHeight = Math.Max(1, current.Height / 2);
                using var next = new Bitmap(nextWidth, nextHeight, PixelFormat.Format32bppArgb);
                using (var g = Graphics.FromImage(next))
                {
                    g.CompositingMode = CompositingMode.SourceCopy;
                    g.CompositingQuality = CompositingQuality.HighQuality;
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    g.SmoothingMode = SmoothingMode.HighQuality;
                    g.DrawImage(current, new Rectangle(0, 0, nextWidth, nextHeight), new Rectangle(0, 0, current.Width, current.Height), GraphicsUnit.Pixel);
                }

                current.Dispose();
                current = CloneAsArgb(next);
            }
        }
        finally
        {
            current.Dispose();
        }

        return result;
    }

    private static Bitmap CloneAsArgb(Bitmap source)
    {
        var clone = new Bitmap(source.Width, source.Height, PixelFormat.Format32bppArgb);
        using var g = Graphics.FromImage(clone);
        g.DrawImage(source, new Rectangle(0, 0, source.Width, source.Height), new Rectangle(0, 0, source.Width, source.Height), GraphicsUnit.Pixel);
        return clone;
    }

    private static byte[] ExtractBgraBytes(Bitmap bitmap)
    {
        var rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        var data = bitmap.LockBits(rect, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            var row = bitmap.Width * 4;
            var result = new byte[bitmap.Width * bitmap.Height * 4];
            if (data.Stride == row)
            {
                Marshal.Copy(data.Scan0, result, 0, result.Length);
            }
            else
            {
                for (var y = 0; y < bitmap.Height; y++)
                {
                    Marshal.Copy(data.Scan0 + (y * data.Stride), result, y * row, row);
                }
            }

            return result;
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
    }

    private static void WriteUInt32(byte[] buffer, int offset, uint value)
    {
        buffer[offset] = (byte)(value & 0xff);
        buffer[offset + 1] = (byte)((value >> 8) & 0xff);
        buffer[offset + 2] = (byte)((value >> 16) & 0xff);
        buffer[offset + 3] = (byte)((value >> 24) & 0xff);
    }

    private static int GetMipCount(Texture texture, int width, int height)
    {
        try
        {
            var dds = DDSIO.GetDDSFile(texture);
            if (dds is { Length: >= 32 } &&
                dds[0] == (byte)'D' &&
                dds[1] == (byte)'D' &&
                dds[2] == (byte)'S' &&
                dds[3] == (byte)' ')
            {
                var headerMipCount = BitConverter.ToUInt32(dds, 28);
                if (headerMipCount > 0)
                {
                    return (int)headerMipCount;
                }
            }
        }
        catch
        {
            // fallback below
        }

        var candidates = new[] { "MipCount", "MipLevels", "Levels", "MipMapCount", "LevelCount" };
        var type = texture.GetType();
        foreach (var candidate in candidates)
        {
            var prop = type.GetProperty(candidate);
            if (prop is null)
            {
                continue;
            }

            try
            {
                var value = prop.GetValue(texture);
                if (value is int iv && iv > 0)
                {
                    return iv;
                }
                if (value is uint uv && uv > 0)
                {
                    return (int)uv;
                }
            }
            catch
            {
                // fallback below
            }
        }

        var count = 1;
        while (width > 1 || height > 1)
        {
            width = Math.Max(1, width / 2);
            height = Math.Max(1, height / 2);
            count++;
        }
        return count;
    }

    internal static string BuildPreviewBase64(string label, int width, int height, bool optimized)
    {
        using var bitmap = new Bitmap(512, 512);
        using var graphics = Graphics.FromImage(bitmap);

        graphics.Clear(optimized ? Color.FromArgb(14, 54, 36) : Color.FromArgb(28, 30, 44));

        using var brushA = new SolidBrush(Color.FromArgb(60, 90, 255));
        using var brushB = new SolidBrush(Color.FromArgb(32, 35, 46));

        const int size = 32;
        for (var y = 0; y < 512; y += size)
        {
            for (var x = 0; x < 512; x += size)
            {
                var even = ((x / size + y / size) & 1) == 0;
                graphics.FillRectangle(even ? brushA : brushB, x, y, size, size);
            }
        }

        using var borderPen = new Pen(Color.FromArgb(91, 124, 246), 2);
        graphics.DrawRectangle(borderPen, 8, 8, 496, 496);

        using var font = new Font("Consolas", 16, FontStyle.Bold);
        using var whiteBrush = new SolidBrush(Color.FromArgb(232, 232, 240));
        graphics.DrawString(label, font, whiteBrush, 16, 16);
        graphics.DrawString($"{width}x{height}", font, whiteBrush, 16, 44);
        graphics.DrawString(optimized ? "OPTIMIZED" : "ORIGINAL", font, whiteBrush, 16, 72);

        using var ms = new MemoryStream();
        bitmap.Save(ms, ImageFormat.Png);
        return Convert.ToBase64String(ms.ToArray());
    }
}

public sealed class YtdFileItem
{
    public string Id { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool Expanded { get; set; }
    public bool Checked { get; set; }
    public int ProcessedCount { get; set; }
    public List<TextureItem> Textures { get; set; } = [];
}

public sealed class TextureItem
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Width { get; set; }
    public int Height { get; set; }
    public int MipCount { get; set; } = 1;
    public string Format { get; set; } = "DXT5";
    public double SizeKb { get; set; }
    public bool Checked { get; set; }
    public bool Excluded { get; set; }
    public string Status { get; set; } = "ready";
    public string? Error { get; set; }
    public string? OriginalPreview { get; set; }
    public string? OptimizedPreview { get; set; }
    public OptimizedInfo? OptimizedInfo { get; set; }
}

public sealed class OptimizedInfo
{
    public int Width { get; set; }
    public int Height { get; set; }
    public int MipCount { get; set; } = 1;
    public string Format { get; set; } = "BC7_UNORM";
    public double SizeKb { get; set; }
}
