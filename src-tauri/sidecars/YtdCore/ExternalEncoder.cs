using System.Diagnostics;

namespace YtdCore;

public static class ExternalEncoder
{
    public static bool TryEncode(
        string encoderId,
        byte[] inputDds,
        string outputFormat,
        int mipCount,
        bool maxQuality,
        out byte[] encodedDds,
        out string error)
    {
        encodedDds = inputDds;
        error = string.Empty;

        if (inputDds.Length == 0)
        {
            error = "input DDS is empty";
            return false;
        }

        try
        {
            return encoderId.ToLowerInvariant() switch
            {
                "texconv" => TryEncodeTexconv(inputDds, outputFormat, mipCount, maxQuality, out encodedDds, out error),
                "magick" => TryEncodeMagick(inputDds, outputFormat, out encodedDds, out error),
                "nvtt" => TryEncodeNvtt(inputDds, outputFormat, mipCount, out encodedDds, out error),
                _ => Fail("unknown encoder", inputDds, out encodedDds, out error)
            };
        }
        catch (Exception ex)
        {
            encodedDds = inputDds;
            error = ex.Message;
            return false;
        }
    }

    private static bool TryEncodeTexconv(byte[] inputDds, string outputFormat, int mipCount, bool maxQuality, out byte[] encodedDds, out string error)
    {
        encodedDds = inputDds;
        error = string.Empty;
        var texconvPath = ResolveBinaryPath("texconv.exe");
        if (texconvPath is null)
        {
            error = "texconv.exe not found";
            return false;
        }

        var format = MapToTexconvFormat(outputFormat);
        if (string.IsNullOrWhiteSpace(format))
        {
            return true;
        }

        var tempDir = Path.Combine(Path.GetTempPath(), "ytd-opt-texconv-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        try
        {
            var inputPath = Path.Combine(tempDir, "input.dds");
            File.WriteAllBytes(inputPath, inputDds);

            var args = new List<string>
            {
                "-nologo",
                "-y",
                "-f", format,
                "-m", Math.Max(1, mipCount).ToString(),
                "-o", tempDir
            };
            if (maxQuality)
            {
                args.Add("-bc");
                args.Add("x");
            }
            args.Add(inputPath);

            var (exitCode, stdErr) = RunProcess(texconvPath, args, tempDir, 60000);
            if (exitCode != 0)
            {
                error = $"texconv exit {exitCode}: {stdErr}";
                return false;
            }

            var outFile = Directory.GetFiles(tempDir, "*.dds", SearchOption.TopDirectoryOnly)
                .Concat(Directory.GetFiles(tempDir, "*.DDS", SearchOption.TopDirectoryOnly))
                .FirstOrDefault(path => !path.EndsWith("input.dds", StringComparison.OrdinalIgnoreCase));
            if (outFile is null || !File.Exists(outFile))
            {
                error = "texconv produced no output";
                return false;
            }

            encodedDds = File.ReadAllBytes(outFile);
            return encodedDds.Length > 0;
        }
        finally
        {
            SafeDeleteDirectory(tempDir);
        }
    }

    private static bool TryEncodeMagick(byte[] inputDds, string outputFormat, out byte[] encodedDds, out string error)
    {
        encodedDds = inputDds;
        error = string.Empty;
        var magickPath = ResolveBinaryPath("magick.exe");
        if (magickPath is null)
        {
            error = "magick.exe not found";
            return false;
        }

        var compression = MapToMagickCompression(outputFormat);
        if (string.IsNullOrWhiteSpace(compression))
        {
            return true;
        }

        var tempDir = Path.Combine(Path.GetTempPath(), "ytd-opt-magick-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        try
        {
            var inputPath = Path.Combine(tempDir, "input.dds");
            var outputPath = Path.Combine(tempDir, "output.dds");
            File.WriteAllBytes(inputPath, inputDds);

            var args = new List<string>
            {
                inputPath,
                "-define", $"dds:compression={compression}",
                outputPath
            };

            var (exitCode, stdErr) = RunProcess(magickPath, args, tempDir, 60000);
            if (exitCode != 0 || !File.Exists(outputPath))
            {
                error = $"magick exit {exitCode}: {stdErr}";
                return false;
            }

            encodedDds = File.ReadAllBytes(outputPath);
            return encodedDds.Length > 0;
        }
        finally
        {
            SafeDeleteDirectory(tempDir);
        }
    }

    private static bool TryEncodeNvtt(byte[] inputDds, string outputFormat, int mipCount, out byte[] encodedDds, out string error)
    {
        encodedDds = inputDds;
        error = string.Empty;
        var nvttExportPath = ResolveBinaryPath("nvtt_export.exe");
        var nvcompressPath = ResolveBinaryPath("nvcompress.exe");
        if (nvttExportPath is null && nvcompressPath is null)
        {
            error = "nvtt_export.exe/nvcompress.exe not found";
            return false;
        }

        var format = MapToNvttFormat(outputFormat);
        if (string.IsNullOrWhiteSpace(format))
        {
            return true;
        }

        var tempDir = Path.Combine(Path.GetTempPath(), "ytd-opt-nvtt-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        try
        {
            var inputPath = Path.Combine(tempDir, "input.dds");
            var outputPath = Path.Combine(tempDir, "output.dds");
            File.WriteAllBytes(inputPath, inputDds);

            if (nvttExportPath is not null)
            {
                var args = new List<string>
                {
                    "--format", format,
                    "--mip-count", Math.Max(1, mipCount).ToString(),
                    "--output", outputPath,
                    inputPath
                };
                var (exitCode, stdErr) = RunProcess(nvttExportPath, args, tempDir, 60000);
                if (exitCode != 0 || !File.Exists(outputPath))
                {
                    error = $"nvtt_export exit {exitCode}: {stdErr}";
                    return false;
                }
            }
            else
            {
                var nvcompressFormat = MapToNvcompressFormat(format);
                if (string.IsNullOrWhiteSpace(nvcompressFormat))
                {
                    error = $"unsupported nvcompress format: {format}";
                    return false;
                }

                var args = new List<string>();
                if (Math.Max(1, mipCount) <= 1)
                {
                    args.Add("-nomips");
                }
                args.Add(nvcompressFormat);
                args.Add(inputPath);
                args.Add(outputPath);

                var (exitCode, stdErr) = RunProcess(nvcompressPath!, args, tempDir, 60000);
                if (exitCode != 0 || !File.Exists(outputPath))
                {
                    error = $"nvcompress exit {exitCode}: {stdErr}";
                    return false;
                }
            }

            encodedDds = File.ReadAllBytes(outputPath);
            return encodedDds.Length > 0;
        }
        finally
        {
            SafeDeleteDirectory(tempDir);
        }
    }

    private static string? ResolveBinaryPath(string fileName)
    {
        if (Path.IsPathRooted(fileName) && File.Exists(fileName))
        {
            return fileName;
        }

        var baseDir = AppContext.BaseDirectory;
        var probePaths = new[]
        {
            Path.Combine(baseDir, fileName),
            Path.Combine(baseDir, "encoders", fileName),
            Path.Combine(baseDir, "encoders", "texconv", fileName),
            Path.Combine(baseDir, "encoders", "nvtt", fileName),
            Path.Combine(baseDir, "encoders", "nvtt", "bin64", fileName),
            Path.Combine(baseDir, "encoders", "magick", fileName),
            Path.Combine(baseDir, "resources", "encoders", fileName),
            Path.Combine(baseDir, "resources", "encoders", "texconv", fileName),
            Path.Combine(baseDir, "resources", "encoders", "nvtt", fileName),
            Path.Combine(baseDir, "resources", "encoders", "nvtt", "bin64", fileName),
            Path.Combine(baseDir, "resources", "encoders", "magick", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "encoders", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "encoders", "texconv", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "encoders", "nvtt", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "encoders", "nvtt", "bin64", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "encoders", "magick", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "tools", "encoders", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "tools", "encoders", "texconv", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "tools", "encoders", "nvtt", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "tools", "encoders", "nvtt", "bin64", fileName),
            Path.Combine(Directory.GetCurrentDirectory(), "tools", "encoders", "magick", fileName)
        };

        foreach (var probe in probePaths)
        {
            if (File.Exists(probe))
            {
                return probe;
            }
        }

        var path = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (var part in path.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            try
            {
                var candidate = Path.Combine(part.Trim(), fileName);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }
            catch
            {
                // ignore invalid path segment
            }
        }

        return null;
    }

    private static (int exitCode, string stdErr) RunProcess(string exePath, List<string> args, string workDir, int timeoutMs)
    {
        using var process = new Process();
        process.StartInfo.FileName = exePath;
        process.StartInfo.WorkingDirectory = workDir;
        process.StartInfo.UseShellExecute = false;
        process.StartInfo.CreateNoWindow = true;
        process.StartInfo.RedirectStandardError = true;
        process.StartInfo.RedirectStandardOutput = true;
        foreach (var arg in args)
        {
            process.StartInfo.ArgumentList.Add(arg);
        }

        process.Start();
        if (!process.WaitForExit(timeoutMs))
        {
            try
            {
                process.Kill(true);
            }
            catch
            {
                // ignore
            }

            return (-1, "timeout");
        }

        var stdErr = process.StandardError.ReadToEnd();
        var stdOut = process.StandardOutput.ReadToEnd();
        var merged = string.IsNullOrWhiteSpace(stdErr) ? stdOut : stdErr;
        return (process.ExitCode, merged.Trim());
    }

    private static void SafeDeleteDirectory(string path)
    {
        try
        {
            if (Directory.Exists(path))
            {
                Directory.Delete(path, true);
            }
        }
        catch
        {
            // best effort temp cleanup
        }
    }

    private static string NormalizeFormat(string format)
    {
        return (format ?? string.Empty)
            .Trim()
            .ToUpperInvariant()
            .Replace("D3DFMT_", string.Empty)
            .Replace("DXGI_FORMAT_", string.Empty);
    }

    private static string? MapToTexconvFormat(string format)
    {
        return NormalizeFormat(format) switch
        {
            "" => null,
            "AUTO" => null,
            "DXT1" or "BC1_UNORM" => "DXT1",
            "DXT3" or "BC2_UNORM" => "DXT3",
            "DXT5" or "BC3_UNORM" => "DXT5",
            "BC7_UNORM" => "BC7_UNORM",
            "A8R8G8B8" or "R8G8B8A8" or "R8G8B8A8_UNORM" => "R8G8B8A8_UNORM",
            _ => null
        };
    }

    private static string? MapToMagickCompression(string format)
    {
        return NormalizeFormat(format) switch
        {
            "" => null,
            "AUTO" => null,
            "DXT1" or "BC1_UNORM" => "dxt1",
            "DXT3" or "BC2_UNORM" => "dxt3",
            "DXT5" or "BC3_UNORM" => "dxt5",
            "BC7_UNORM" => "bc7",
            _ => null
        };
    }

    private static string? MapToNvttFormat(string format)
    {
        return NormalizeFormat(format) switch
        {
            "" => null,
            "AUTO" => null,
            "DXT1" or "BC1_UNORM" => "bc1",
            "DXT3" or "BC2_UNORM" => "bc2",
            "DXT5" or "BC3_UNORM" => "bc3",
            "BC7_UNORM" => "bc7",
            _ => null
        };
    }

    private static string? MapToNvcompressFormat(string nvttFormat)
    {
        return (nvttFormat ?? string.Empty).Trim().ToLowerInvariant() switch
        {
            "bc1" => "-bc1",
            "bc2" => "-bc2",
            "bc3" => "-bc3",
            "bc7" => "-bc7",
            _ => null
        };
    }

    private static bool Fail(string reason, byte[] inputDds, out byte[] encodedDds, out string error)
    {
        encodedDds = inputDds;
        error = reason;
        return false;
    }
}
