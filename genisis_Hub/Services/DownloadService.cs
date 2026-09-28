using System.IO.Compression;
using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Models;

namespace genisis_Hub.Services
{
    public interface IDownloadService
    {
        Task LogDownloadsAsync(ulong? userId, IEnumerable<Photo> photos, string type, string? ip, string? ua);
        Task<string> CreateZipFileAsync(IEnumerable<Photo> photos);
        Task<List<Download>> GetDownloadsByEventAsync(ulong eventId);
    }

    public class DownloadService : IDownloadService
    {
        private readonly DbContext _db;
        private readonly ImageStorage _storage;

        public DownloadService(DbContext db, ImageStorage storage)
        {
            _db = db; _storage = storage;
        }

        /// <summary>type: Single | Multiple | Zip (the downloads.download_type enum).</summary>
        public async Task LogDownloadsAsync(ulong? userId, IEnumerable<Photo> photos, string type, string? ip, string? ua)
        {
            var rows = photos.Select(p => new { UserId = userId, p.EventId, p.PhotoId, DownloadType = type, IpAddress = ip, UserAgent = ua }).ToList();
            if (rows.Count == 0) return;
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync(@"
                INSERT INTO downloads (user_id, event_id, photo_id, download_type, ip_address, user_agent)
                VALUES (@UserId, @EventId, @PhotoId, @DownloadType, @IpAddress, @UserAgent)", rows);
        }

        /// <summary>Builds the zip in a temp file (not in memory) and returns its path; caller deletes it.</summary>
        public async Task<string> CreateZipFileAsync(IEnumerable<Photo> photos)
        {
            var path = Path.Combine(Path.GetTempPath(), $"gh-zip-{Guid.NewGuid():N}.zip");
            await using var fs = new FileStream(path, FileMode.CreateNew);
            using var zip = new ZipArchive(fs, ZipArchiveMode.Create);
            var used = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var p in photos)
            {
                if (!_storage.Exists(p.FilePath)) continue;
                // stored files are JPEG; keep the original name but make it unique and .jpg
                var baseName = Path.GetFileNameWithoutExtension(p.OriginalFileName);
                if (string.IsNullOrWhiteSpace(baseName)) baseName = $"photo-{p.PhotoId}";
                var name = $"{baseName}.jpg";
                for (var n = 1; !used.Add(name); n++) name = $"{baseName}_{n}.jpg";
                var entry = zip.CreateEntry(name, CompressionLevel.NoCompression); // JPEGs don't compress further
                await using var es = entry.Open();
                await using var src = File.OpenRead(_storage.Resolve(p.FilePath));
                await src.CopyToAsync(es);
            }
            return path;
        }

        public async Task<List<Download>> GetDownloadsByEventAsync(ulong eventId)
        {
            using var conn = _db.CreateConnection();
            return (await conn.QueryAsync<Download>(
                "SELECT * FROM downloads WHERE event_id=@EventId ORDER BY downloaded_at DESC LIMIT 1000",
                new { EventId = eventId })).ToList();
        }
    }
}
