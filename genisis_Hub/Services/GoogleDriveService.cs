using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace genisis_Hub.Services
{
    /// <summary>A problem the event admin can fix (bad link, not shared, no API key...).</summary>
    public class DriveException(string message) : Exception(message);

    /// <summary>A Drive link: a folder or a single file, plus its resource key (older shared links need it).</summary>
    public record DriveLink(string Id, bool IsFolder, string? ResourceKey);

    /// <summary>An image found in a Drive folder. Path is its folder path inside the shared folder.</summary>
    public record DriveFile(string Id, string Name, string Path, string MimeType, long Size, string? ResourceKey);

    /// <summary>
    /// Imports from Google Drive links shared as "Anyone with the link", using
    /// the Drive API v3 with an API key (Settings: google_drive_api_key). No
    /// Google sign-in is needed, so private folders can't be read.
    /// </summary>
    public partial class GoogleDriveService
    {
        public const int MaxFiles = 5000;
        private const int MaxDepth = 10;
        private const string FolderMime = "application/vnd.google-apps.folder";
        private readonly HttpClient _http;
        private readonly SettingsService _settings;

        public GoogleDriveService(HttpClient http, SettingsService settings)
        {
            _http = http; _settings = settings;
        }

        [GeneratedRegex(@"/folders/([\w-]{10,})")] private static partial Regex FolderRx();
        [GeneratedRegex(@"/(?:file/)?d/([\w-]{10,})")] private static partial Regex FileRx();
        [GeneratedRegex(@"[?&]id=([\w-]{10,})")] private static partial Regex IdParamRx();
        [GeneratedRegex(@"[?&]resourcekey=([\w-]+)", RegexOptions.IgnoreCase)] private static partial Regex ResourceKeyRx();

        /// <summary>
        /// Understands the usual share links:
        ///   drive.google.com/drive/folders/ID  ·  drive.google.com/drive/u/0/folders/ID
        ///   drive.google.com/file/d/ID/view    ·  drive.google.com/open?id=ID  ·  ...uc?id=ID
        /// </summary>
        public static DriveLink? Parse(string? url)
        {
            if (string.IsNullOrWhiteSpace(url)) return null;
            url = url.Trim();
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                !(uri.Host.EndsWith("drive.google.com") || uri.Host.EndsWith("docs.google.com")))
                return null;
            var rk = ResourceKeyRx().Match(url) is { Success: true } k ? k.Groups[1].Value : null;
            if (FolderRx().Match(uri.AbsolutePath) is { Success: true } f) return new DriveLink(f.Groups[1].Value, true, rk);
            if (FileRx().Match(uri.AbsolutePath) is { Success: true } d) return new DriveLink(d.Groups[1].Value, false, rk);
            // open?id= can be either; the listing call below finds out which.
            if (IdParamRx().Match(uri.Query) is { Success: true } q) return new DriveLink(q.Groups[1].Value, !uri.AbsolutePath.Contains("uc"), rk);
            return null;
        }

        private async Task<string> KeyAsync() =>
            await _settings.GoogleDriveApiKeyAsync()
            ?? throw new DriveException("Google Drive import isn’t set up yet. Ask your Super Admin to add a Google API key in Settings (google_drive_api_key).");

        private HttpRequestMessage Request(string url, params (string Id, string? Key)[] resourceKeys)
        {
            var req = new HttpRequestMessage(HttpMethod.Get, url);
            var keys = resourceKeys.Where(r => r.Key != null).Select(r => $"{r.Id}/{r.Key}").ToArray();
            if (keys.Length > 0) req.Headers.Add("X-Goog-Drive-Resource-Keys", string.Join(",", keys));
            return req;
        }

        /// <summary>Turns Drive API errors into messages an event admin can act on.</summary>
        private static async Task<DriveException> ErrorAsync(HttpResponseMessage res)
        {
            string reason = "", message = "";
            try
            {
                using var doc = JsonDocument.Parse(await res.Content.ReadAsStringAsync());
                var err = doc.RootElement.GetProperty("error");
                message = err.TryGetProperty("message", out var m) ? m.GetString() ?? "" : "";
                reason = err.TryGetProperty("errors", out var list) && list.GetArrayLength() > 0 && list[0].TryGetProperty("reason", out var r) ? r.GetString() ?? "" : "";
                if (reason == "" && err.TryGetProperty("status", out var s)) reason = s.GetString() ?? "";
            }
            catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException) { }
            if (message.Contains("API key not valid", StringComparison.OrdinalIgnoreCase) || message.Contains("API key expired", StringComparison.OrdinalIgnoreCase))
                reason = "keyInvalid";

            return (res.StatusCode, reason) switch
            {
                (HttpStatusCode.NotFound, _) => new DriveException("We couldn’t open that link. In Google Drive, set sharing to “Anyone with the link” and try again."),
                (_, "keyInvalid") => new DriveException("The Google API key in Settings isn’t valid. Ask your Super Admin to check it."),
                (_, "accessNotConfigured" or "SERVICE_DISABLED") => new DriveException("The Google Drive API isn’t enabled for this API key. Enable “Google Drive API” in the Google Cloud console."),
                (_, "dailyLimitExceeded" or "userRateLimitExceeded" or "rateLimitExceeded") => new DriveException("Google Drive is limiting requests right now. Wait a minute and try again."),
                (HttpStatusCode.Forbidden or HttpStatusCode.Unauthorized, _) => new DriveException("Google Drive didn’t allow access. Make sure the link is shared as “Anyone with the link”."),
                _ => new DriveException($"Google Drive returned an error ({(int)res.StatusCode}). Please try again."),
            };
        }

        private async Task<JsonDocument> GetJsonAsync(HttpRequestMessage req, CancellationToken ct)
        {
            using var res = await _http.SendAsync(req, ct);
            if (!res.IsSuccessStatusCode) throw await ErrorAsync(res);
            return JsonDocument.Parse(await res.Content.ReadAsStreamAsync(ct));
        }

        /// <summary>Name and type of the linked item (to tell a folder from a file, and to show the folder name).</summary>
        public async Task<(string Name, bool IsFolder, string MimeType, long Size, string? ResourceKey)> GetInfoAsync(DriveLink link, CancellationToken ct = default)
        {
            var key = await KeyAsync();
            var url = $"https://www.googleapis.com/drive/v3/files/{link.Id}?fields=id,name,mimeType,size,resourceKey&supportsAllDrives=true&key={Uri.EscapeDataString(key)}";
            using var doc = await GetJsonAsync(Request(url, (link.Id, link.ResourceKey)), ct);
            var r = doc.RootElement;
            var mime = r.GetProperty("mimeType").GetString() ?? "";
            return (r.GetProperty("name").GetString() ?? "", mime == FolderMime, mime,
                    r.TryGetProperty("size", out var s) && long.TryParse(s.GetString(), out var n) ? n : 0,
                    r.TryGetProperty("resourceKey", out var rk) ? rk.GetString() : link.ResourceKey);
        }

        /// <summary>
        /// Every file in the folder (and, if asked, its subfolders), up to MaxFiles.
        /// Returns all files; the caller decides which are photos.
        /// </summary>
        public async Task<(List<DriveFile> Files, bool Truncated)> ListAsync(string folderId, string? resourceKey, bool recursive, CancellationToken ct = default)
        {
            var key = await KeyAsync();
            var files = new List<DriveFile>();
            var queue = new Queue<(string Id, string? ResourceKey, string Path, int Depth)>();
            queue.Enqueue((folderId, resourceKey, "", 0));
            while (queue.Count > 0)
            {
                var (id, rk, path, depth) = queue.Dequeue();
                string? page = null;
                do
                {
                    var q = Uri.EscapeDataString($"'{id}' in parents and trashed = false");
                    var url = "https://www.googleapis.com/drive/v3/files" +
                              $"?q={q}&pageSize=1000&orderBy=name&supportsAllDrives=true&includeItemsFromAllDrives=true" +
                              "&fields=nextPageToken,files(id,name,mimeType,size,resourceKey)" +
                              $"&key={Uri.EscapeDataString(key)}" + (page != null ? $"&pageToken={Uri.EscapeDataString(page)}" : "");
                    using var doc = await GetJsonAsync(Request(url, (id, rk)), ct);
                    foreach (var f in doc.RootElement.GetProperty("files").EnumerateArray())
                    {
                        var fid = f.GetProperty("id").GetString()!;
                        var name = f.GetProperty("name").GetString() ?? fid;
                        var mime = f.GetProperty("mimeType").GetString() ?? "";
                        var frk = f.TryGetProperty("resourceKey", out var r) ? r.GetString() : null;
                        if (mime == FolderMime)
                        {
                            if (recursive && depth < MaxDepth) queue.Enqueue((fid, frk, path + name + "/", depth + 1));
                            continue;
                        }
                        var size = f.TryGetProperty("size", out var s) && long.TryParse(s.GetString(), out var n) ? n : 0;
                        files.Add(new DriveFile(fid, name, path, mime, size, frk));
                        if (files.Count >= MaxFiles) return (files, true);
                    }
                    page = doc.RootElement.TryGetProperty("nextPageToken", out var t) ? t.GetString() : null;
                } while (page != null);
            }
            return (files, false);
        }

        /// <summary>Downloads a file's bytes (up to maxBytes) into memory.</summary>
        public async Task<MemoryStream> DownloadAsync(string fileId, string? resourceKey, long maxBytes, CancellationToken ct = default)
        {
            var key = await KeyAsync();
            var url = $"https://www.googleapis.com/drive/v3/files/{Uri.EscapeDataString(fileId)}?alt=media&supportsAllDrives=true&key={Uri.EscapeDataString(key)}";
            using var res = await _http.SendAsync(Request(url, (fileId, resourceKey)), HttpCompletionOption.ResponseHeadersRead, ct);
            if (!res.IsSuccessStatusCode) throw await ErrorAsync(res);
            if (res.Content.Headers.ContentLength > maxBytes) throw new DriveException("File is larger than the upload limit");

            var ms = new MemoryStream();
            await using var body = await res.Content.ReadAsStreamAsync(ct);
            var buffer = new byte[81920];
            int read;
            while ((read = await body.ReadAsync(buffer, ct)) > 0)
            {
                if (ms.Length + read > maxBytes) throw new DriveException("File is larger than the upload limit");
                ms.Write(buffer, 0, read);
            }
            ms.Position = 0;
            return ms;
        }
    }
}
