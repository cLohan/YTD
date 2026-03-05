namespace YtdCore;

public static class EncoderDetector
{
    public static List<object> Detect()
    {
        return
        [
            new
            {
                id = "internal",
                label = "CodeWalker + SharpDX",
                detected = true,
                source = "Built-in"
            },
            new
            {
                id = "nvtt",
                label = "NVTT",
                detected = ExistsInPath("nvtt_export.exe")
                    || ExistsNearApp("nvtt_export.exe")
                    || ExistsInWorkspace("nvtt_export.exe")
                    || ExistsNearApp("nvcompress.exe")
                    || ExistsInWorkspace("nvcompress.exe")
                    || ExistsNearApp("nvtt.dll"),
                source = "nvtt_export.exe / nvcompress.exe / nvtt.dll"
            },
            new
            {
                id = "texconv",
                label = "DirectXTex / texconv",
                detected = ExistsInPath("texconv.exe") || ExistsNearApp("texconv.exe") || ExistsInWorkspace("texconv.exe"),
                source = "texconv.exe"
            },
            new
            {
                id = "magick",
                label = "ImageMagick",
                detected = ExistsInPath("magick.exe") || ExistsNearApp("magick.exe") || ExistsInWorkspace("magick.exe"),
                source = "magick.exe"
            }
        ];
    }

    private static bool ExistsNearApp(string fileName)
    {
        var baseDir = AppContext.BaseDirectory;
        return File.Exists(Path.Combine(baseDir, fileName))
            || File.Exists(Path.Combine(baseDir, "encoders", fileName))
            || File.Exists(Path.Combine(baseDir, "encoders", "texconv", fileName))
            || File.Exists(Path.Combine(baseDir, "encoders", "nvtt", fileName))
            || File.Exists(Path.Combine(baseDir, "encoders", "nvtt", "bin64", fileName))
            || File.Exists(Path.Combine(baseDir, "encoders", "magick", fileName))
            || File.Exists(Path.Combine(baseDir, "resources", fileName))
            || File.Exists(Path.Combine(baseDir, "resources", "encoders", fileName))
            || File.Exists(Path.Combine(baseDir, "resources", "encoders", "texconv", fileName))
            || File.Exists(Path.Combine(baseDir, "resources", "encoders", "nvtt", fileName))
            || File.Exists(Path.Combine(baseDir, "resources", "encoders", "nvtt", "bin64", fileName))
            || File.Exists(Path.Combine(baseDir, "resources", "encoders", "magick", fileName));
    }

    private static bool ExistsInPath(string fileName)
    {
        var path = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
        foreach (var part in path.Split(';', StringSplitOptions.RemoveEmptyEntries))
        {
            try
            {
                if (File.Exists(Path.Combine(part.Trim(), fileName)))
                {
                    return true;
                }
            }
            catch
            {
                // ignore malformed PATH entries
            }
        }

        return false;
    }

    private static bool ExistsInWorkspace(string fileName)
    {
        var cwd = Directory.GetCurrentDirectory();
        return File.Exists(Path.Combine(cwd, "tools", "encoders", fileName))
            || File.Exists(Path.Combine(cwd, "tools", "encoders", "texconv", fileName))
            || File.Exists(Path.Combine(cwd, "tools", "encoders", "nvtt", fileName))
            || File.Exists(Path.Combine(cwd, "tools", "encoders", "nvtt", "bin64", fileName))
            || File.Exists(Path.Combine(cwd, "tools", "encoders", "magick", fileName))
            || File.Exists(Path.Combine(cwd, "encoders", fileName))
            || File.Exists(Path.Combine(cwd, "encoders", "texconv", fileName))
            || File.Exists(Path.Combine(cwd, "encoders", "nvtt", fileName))
            || File.Exists(Path.Combine(cwd, "encoders", "nvtt", "bin64", fileName))
            || File.Exists(Path.Combine(cwd, "encoders", "magick", fileName));
    }
}
