using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace genisis_Hub.Services
{
    // ── Python FastAPI contract (app/web/face_search_server.py) ──────────────
    // POST /api/analyze   multipart field "image"            -> AiAnalyzeResponse
    // POST /api/query     multipart field "images" (1..5)    -> AiQueryResponse
    // Boxes are [x1, y1, x2, y2] as fractions (0..1) of the analysed image;
    // embeddings are base64 of 512 little-endian float32 (2048 bytes) -- the
    // exact bytes stored in faces.embedding.
    public class AiFace
    {
        [JsonPropertyName("box")]       public float[] Box { get; set; } = Array.Empty<float>();
        [JsonPropertyName("score")]     public float Score { get; set; }
        [JsonPropertyName("embedding")] public string Embedding { get; set; } = string.Empty;
    }

    public class AiAnalyzeResponse
    {
        [JsonPropertyName("width")]  public int Width { get; set; }
        [JsonPropertyName("height")] public int Height { get; set; }
        [JsonPropertyName("faces")]  public List<AiFace> Faces { get; set; } = new();
    }

    public class AiQueryResponse
    {
        [JsonPropertyName("embedding")]       public string Embedding { get; set; } = string.Empty;
        [JsonPropertyName("match_threshold")] public decimal? MatchThreshold { get; set; }
    }

    /// <summary>
    /// Why the AI call failed. NoFace/FaceTooSmall/Unreadable are the user's
    /// photo; Unavailable means the Python server is down or erroring.
    /// </summary>
    public enum AiErrorKind { None, NoFace, FaceTooSmall, Unreadable, Unavailable }

    public record AiResult<T>(T? Value, AiErrorKind Error, string? Message)
    {
        public bool Ok => Error == AiErrorKind.None && Value is not null;
    }

    public class AiFaceClient
    {
        private readonly HttpClient _http;
        private readonly ILogger<AiFaceClient> _logger;
        private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

        public AiFaceClient(HttpClient http, ILogger<AiFaceClient> logger, IConfiguration config)
        {
            _http = http;
            _logger = logger;
            // Optional shared secret, if the Python server is put behind one.
            var key = config["AiServer:ApiKey"];
            if (!string.IsNullOrWhiteSpace(key) && !_http.DefaultRequestHeaders.Contains("X-Api-Key"))
                _http.DefaultRequestHeaders.Add("X-Api-Key", key);
        }

        /// <summary>Every face in one photo, with boxes and embeddings.</summary>
        public async Task<AiResult<AiAnalyzeResponse>> AnalyzeAsync(byte[] jpeg, string fileName = "photo.jpg")
        {
            using var content = new MultipartFormDataContent();
            content.Add(new ByteArrayContent(jpeg) { Headers = { ContentType = new("image/jpeg") } }, "image", fileName);
            return await PostAsync<AiAnalyzeResponse>("/api/analyze", content);
        }

        /// <summary>One averaged embedding for the most prominent face across 1-5 selfie frames.</summary>
        public async Task<AiResult<float[]>> QueryAsync(IEnumerable<(byte[] bytes, string name)> selfies)
        {
            using var content = new MultipartFormDataContent();
            foreach (var (bytes, name) in selfies.Take(5))
                content.Add(new ByteArrayContent(bytes) { Headers = { ContentType = new("image/jpeg") } }, "images", name);
            var r = await PostAsync<AiQueryResponse>("/api/query", content);
            if (!r.Ok) return new(null, r.Error, r.Message);
            var emb = DecodeEmbedding(r.Value!.Embedding);
            return emb is null
                ? new(null, AiErrorKind.Unavailable, "The face engine returned an invalid embedding")
                : new(emb, AiErrorKind.None, null);
        }

        public async Task<bool> IsHealthyAsync()
        {
            try
            {
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                var res = await _http.GetAsync("/api/status", cts.Token);
                return res.IsSuccessStatusCode;
            }
            catch { return false; }
        }

        public static byte[]? DecodeEmbeddingBytes(string b64)
        {
            try
            {
                var bytes = Convert.FromBase64String(b64);
                return bytes.Length == 512 * 4 ? bytes : null;
            }
            catch (FormatException) { return null; }
        }

        public static float[]? DecodeEmbedding(string b64)
        {
            var bytes = DecodeEmbeddingBytes(b64);
            if (bytes is null) return null;
            var floats = new float[512];
            Buffer.BlockCopy(bytes, 0, floats, 0, bytes.Length);
            return floats;
        }

        private async Task<AiResult<T>> PostAsync<T>(string path, HttpContent content) where T : class
        {
            HttpResponseMessage res;
            try
            {
                res = await _http.PostAsync(path, content);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AI server unreachable at {Path}", path);
                return new(null, AiErrorKind.Unavailable, "The face engine is not reachable");
            }

            var body = await res.Content.ReadAsStringAsync();
            if (res.StatusCode == HttpStatusCode.UnprocessableEntity)
            {
                // Python explains why: "couldn't find a face", "too small", "isn't an image"...
                var detail = TryDetail(body) ?? "No usable face found";
                var lower = detail.ToLowerInvariant();
                var kind = lower.Contains("too small") || lower.Contains("closer") ? AiErrorKind.FaceTooSmall
                         : lower.Contains("isn't an image") || lower.Contains("read") ? AiErrorKind.Unreadable
                         : AiErrorKind.NoFace;
                return new(null, kind, detail);
            }
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogError("AI server {Path} returned {Status}: {Body}", path, (int)res.StatusCode, body.Length > 300 ? body[..300] : body);
                return new(null, AiErrorKind.Unavailable,
                    res.StatusCode == HttpStatusCode.RequestEntityTooLarge ? "Image is too large for the face engine" : "The face engine returned an error");
            }
            try
            {
                return new(JsonSerializer.Deserialize<T>(body, Json), AiErrorKind.None, null);
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "AI server {Path} returned unexpected JSON", path);
                return new(null, AiErrorKind.Unavailable, "The face engine returned an unexpected response");
            }
        }

        private static string? TryDetail(string body)
        {
            try
            {
                using var doc = JsonDocument.Parse(body);
                return doc.RootElement.TryGetProperty("detail", out var d) && d.ValueKind == JsonValueKind.String ? d.GetString() : null;
            }
            catch (JsonException) { return null; }
        }
    }
}
