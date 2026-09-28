using System.Globalization;
using Dapper;
using genisis_Hub.Data;

namespace genisis_Hub.Services
{
    /// <summary>
    /// Reads system_settings with a short cache. The match threshold, upload
    /// size limit and allowed types always come from here -- never from the
    /// client.
    /// </summary>
    public class SettingsService
    {
        private readonly DbContext _db;
        private static Dictionary<string, string> _cache = new();
        private static DateTime _loadedAt = DateTime.MinValue;
        private static readonly SemaphoreSlim _lock = new(1, 1);

        private readonly IConfiguration _config;

        public SettingsService(DbContext db, IConfiguration config)
        {
            _db = db; _config = config;
        }

        private async Task<Dictionary<string, string>> AllAsync()
        {
            if (DateTime.UtcNow - _loadedAt < TimeSpan.FromSeconds(60)) return _cache;
            await _lock.WaitAsync();
            try
            {
                if (DateTime.UtcNow - _loadedAt < TimeSpan.FromSeconds(60)) return _cache;
                using var conn = _db.CreateConnection();
                var rows = await conn.QueryAsync<(string Key, string Value)>(
                    "SELECT setting_key AS `Key`, setting_value AS `Value` FROM system_settings");
                _cache = rows.ToDictionary(r => r.Key, r => r.Value);
                _loadedAt = DateTime.UtcNow;
                return _cache;
            }
            finally { _lock.Release(); }
        }

        public static void Invalidate() => _loadedAt = DateTime.MinValue;

        public async Task<decimal> MatchThresholdAsync()
        {
            var all = await AllAsync();
            return all.TryGetValue("face_similarity_threshold", out var v)
                   && decimal.TryParse(v, NumberStyles.Number, CultureInfo.InvariantCulture, out var d)
                   && d > 0 && d < 1 ? d : 0.35m;
        }

        public async Task<long> MaxUploadBytesAsync()
        {
            var all = await AllAsync();
            return (all.TryGetValue("max_upload_size_mb", out var v) && int.TryParse(v, out var mb) && mb > 0 ? mb : 100) * 1024L * 1024L;
        }

        /// <summary>Google API key for Drive imports: system_settings, else GoogleDrive:ApiKey in config.</summary>
        public async Task<string?> GoogleDriveApiKeyAsync()
        {
            var all = await AllAsync();
            var key = all.TryGetValue("google_drive_api_key", out var v) && !string.IsNullOrWhiteSpace(v) ? v : _config["GoogleDrive:ApiKey"];
            return string.IsNullOrWhiteSpace(key) ? null : key.Trim();
        }

        public async Task<HashSet<string>> AllowedImageTypesAsync()
        {
            var all = await AllAsync();
            var raw = all.TryGetValue("allowed_image_types", out var v) ? v : "jpg,jpeg,png,webp";
            return raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                      .Select(x => x.TrimStart('.').ToLowerInvariant()).ToHashSet();
        }
    }
}
