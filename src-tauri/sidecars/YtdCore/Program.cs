using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace YtdCore;

public static class Program
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private static readonly object WriteLock = new();
    private static readonly YtdService YtdService = new();
    private static readonly TextureProcessor TextureProcessor = new();
    private static readonly ConcurrentDictionary<string, CancellationTokenSource> RunningJobs = new();

    public static async Task Main()
    {
        Console.InputEncoding = System.Text.Encoding.UTF8;
        Console.OutputEncoding = System.Text.Encoding.UTF8;

        string? line;
        while ((line = await Console.In.ReadLineAsync()) is not null)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            RpcRequest? request;
            try
            {
                request = JsonSerializer.Deserialize<RpcRequest>(line, JsonOptions);
            }
            catch (Exception ex)
            {
                EmitLog("ERROR", $"JSON inválido: {ex.Message}");
                continue;
            }

            if (request is null)
            {
                continue;
            }

            _ = HandleRequestAsync(request);
        }
    }

    private static async Task HandleRequestAsync(RpcRequest request)
    {
        try
        {
            var parameters = UnwrapConfig(request.Params);
            var result = request.Method switch
            {
                "open_ytd" => await HandleOpenYtdAsync(parameters),
                "get_texture_list" => await HandleTextureListAsync(),
                "get_preview" => await HandlePreviewAsync(parameters),
                "detect_encoders" => await HandleDetectEncodersAsync(),
                "get_encoder_info" => await HandleDetectEncodersAsync(),
                "process_textures" => await HandleProcessTexturesAsync(request.Id, parameters),
                "cancel_processing" => await HandleCancelProcessingAsync(),
                "save_ytd" => await HandleSaveYtdAsync(parameters),
                "export_texture" => await HandleExportTextureAsync(parameters),
                "rename_texture" => await HandleRenameTextureAsync(parameters),
                "remove_texture" => await HandleRemoveTextureAsync(parameters),
                _ => throw new InvalidOperationException($"Método desconhecido: {request.Method}")
            };

            WriteResponse(new RpcResponse
            {
                Id = request.Id,
                Result = result
            });
        }
        catch (Exception ex)
        {
            WriteResponse(new RpcResponse
            {
                Id = request.Id,
                Error = new RpcError
                {
                    Code = -32000,
                    Message = $"{ex.Message}{Environment.NewLine}{ex.StackTrace}"
                }
            });
        }
    }

    private static JsonElement UnwrapConfig(JsonElement value)
    {
        if (value.ValueKind == JsonValueKind.Object && value.TryGetProperty("config", out var config))
        {
            return config;
        }

        return value;
    }

    private static Task<object> HandleOpenYtdAsync(JsonElement parameters)
    {
        var paths = parameters.TryGetProperty("paths", out var pathArray)
            ? pathArray.EnumerateArray().Select(p => p.GetString() ?? string.Empty).Where(p => !string.IsNullOrWhiteSpace(p)).ToList()
            : [];

        var ytds = YtdService.Open(paths);
        EmitLog("INFO", $"{ytds.Count} YTD(s) carregado(s). Total de texturas: {ytds.Sum(y => y.Textures.Count)}");

        return Task.FromResult<object>(new
        {
            ytds
        });
    }

    private static Task<object> HandleTextureListAsync()
    {
        return Task.FromResult<object>(new
        {
            ytds = YtdService.GetAll()
        });
    }

    private static Task<object> HandlePreviewAsync(JsonElement parameters)
    {
        var ytdId = parameters.GetProperty("ytdId").GetString() ?? string.Empty;
        var textureId = parameters.GetProperty("textureId").GetString() ?? string.Empty;
        var optimized = parameters.TryGetProperty("optimized", out var optimizedEl) && optimizedEl.GetBoolean();

        var preview = YtdService.GetPreview(ytdId, textureId, optimized);
        return Task.FromResult<object>(new { preview });
    }

    private static Task<object> HandleDetectEncodersAsync()
    {
        var encoders = EncoderDetector.Detect();
        return Task.FromResult<object>(encoders);
    }

    private static async Task<object> HandleProcessTexturesAsync(string requestId, JsonElement parameters)
    {
        var cts = new CancellationTokenSource();
        RunningJobs[requestId] = cts;

        try
        {
            var updated = await Task.Run(() =>
                TextureProcessor.Process(
                    YtdService,
                    parameters,
                    cts.Token,
                    progress => EmitProgress(progress),
                    (level, message) => EmitLog(level, message)
                ), cts.Token);

            EmitLog("SUCCESS", $"Processamento finalizado com {updated.Count} textura(s) atualizada(s).");
            return new { updated };
        }
        finally
        {
            RunningJobs.TryRemove(requestId, out _);
        }
    }

    private static Task<object> HandleCancelProcessingAsync()
    {
        foreach (var kv in RunningJobs)
        {
            kv.Value.Cancel();
        }

        EmitLog("WARN", "Cancelamento solicitado.");
        return Task.FromResult<object>(new { canceled = true });
    }

    private static Task<object> HandleSaveYtdAsync(JsonElement parameters)
    {
        var result = YtdService.Save(parameters);
        return Task.FromResult<object>(result);
    }

    private static Task<object> HandleExportTextureAsync(JsonElement parameters)
    {
        var ytdId = parameters.GetProperty("ytdId").GetString() ?? string.Empty;
        var textureId = parameters.GetProperty("textureId").GetString() ?? string.Empty;
        var optimized = parameters.TryGetProperty("optimized", out var optimizedEl) && optimizedEl.GetBoolean();
        var format = parameters.TryGetProperty("format", out var formatEl) ? formatEl.GetString() ?? "dds" : "dds";
        var outputPath = parameters.TryGetProperty("outputPath", out var outputEl) ? outputEl.GetString() ?? string.Empty : string.Empty;

        YtdService.ExportTexture(ytdId, textureId, optimized, format, outputPath);
        return Task.FromResult<object>(new { ok = true, outputPath });
    }

    private static Task<object> HandleRenameTextureAsync(JsonElement parameters)
    {
        var ytdId = parameters.GetProperty("ytdId").GetString() ?? string.Empty;
        var textureId = parameters.GetProperty("textureId").GetString() ?? string.Empty;
        var newName = parameters.GetProperty("newName").GetString() ?? string.Empty;

        var texture = YtdService.RenameTexture(ytdId, textureId, newName);
        return Task.FromResult<object>(new { texture });
    }

    private static Task<object> HandleRemoveTextureAsync(JsonElement parameters)
    {
        var ytdId = parameters.GetProperty("ytdId").GetString() ?? string.Empty;
        var textureId = parameters.GetProperty("textureId").GetString() ?? string.Empty;

        YtdService.RemoveTexture(ytdId, textureId);
        return Task.FromResult<object>(new { ok = true });
    }

    private static void EmitProgress(object data)
    {
        WriteEvent("progress", data);
    }

    private static void EmitLog(string level, string message)
    {
        WriteEvent("log", new { level, message });
    }

    private static void WriteResponse(RpcResponse response)
    {
        lock (WriteLock)
        {
            Console.Out.WriteLine(JsonSerializer.Serialize(response, JsonOptions));
        }
    }

    private static void WriteEvent(string eventName, object data)
    {
        lock (WriteLock)
        {
            var payload = new
            {
                @event = eventName,
                data
            };

            Console.Out.WriteLine(JsonSerializer.Serialize(payload, JsonOptions));
        }
    }
}

public sealed class RpcRequest
{
    public string Id { get; set; } = string.Empty;
    public string Method { get; set; } = string.Empty;
    public JsonElement Params { get; set; }
}

public sealed class RpcResponse
{
    public string? Id { get; set; }
    public object? Result { get; set; }
    public RpcError? Error { get; set; }
}

public sealed class RpcError
{
    public int Code { get; set; }
    public string Message { get; set; } = string.Empty;
}
