using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Models;
using genisis_Hub.Models.Responses;
using SixLabors.ImageSharp;

namespace genisis_Hub.Services
{
    public interface IPhotoService
    {
        Task<PagedResponse<Photo>> GetPhotosByEventAsync(ulong eventId, string? status = null, int page = 1, int pageSize = 60);
        Task<Photo?> GetPhotoByIdAsync(ulong photoId);
        Task<List<Photo>> GetPhotosByIdsAsync(IEnumerable<ulong> photoIds);
        Task<UploadResultItem> UploadAsync(IFormFile file, ulong eventId, ulong uploadedBy);
        Task<UploadResultItem> UploadAsync(Stream content, string fileName, long length, ulong eventId, ulong uploadedBy, string? sourceRef = null);
        Task<HashSet<string>> ExistingSourceRefsAsync(ulong eventId, IEnumerable<string> sourceRefs);
        Task<UploadResultItem> ReanalyzeAsync(Photo photo);
        Task<bool> DeletePhotoAsync(ulong photoId);
    }

    public class PhotoService : IPhotoService
    {
        private const string PhotoSelect = @"
            SELECT p.*, u.full_name AS UploadedByName, e.event_name AS EventName
            FROM photos p
            JOIN users u ON p.uploaded_by = u.user_id
            JOIN events e ON p.event_id = e.event_id";

        private readonly DbContext _db;
        private readonly ImageStorage _storage;
        private readonly AiFaceClient _ai;
        private readonly IFaceService _faces;
        private readonly SettingsService _settings;
        private readonly ILogger<PhotoService> _logger;

        public PhotoService(DbContext db, ImageStorage storage, AiFaceClient ai, IFaceService faces,
            SettingsService settings, ILogger<PhotoService> logger)
        {
            _db = db; _storage = storage; _ai = ai; _faces = faces; _settings = settings; _logger = logger;
        }

        public async Task<PagedResponse<Photo>> GetPhotosByEventAsync(ulong eventId, string? status = null, int page = 1, int pageSize = 60)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 500);
            using var conn = _db.CreateConnection();
            var args = new { EventId = eventId, Status = status, Limit = pageSize, Offset = (page - 1) * pageSize };
            var items = await conn.QueryAsync<Photo>(PhotoSelect + @"
                WHERE p.event_id = @EventId AND (@Status IS NULL OR p.status = @Status)
                ORDER BY p.uploaded_at DESC, p.photo_id DESC
                LIMIT @Limit OFFSET @Offset", args);
            var total = await conn.ExecuteScalarAsync<long>(
                "SELECT COUNT(*) FROM photos p WHERE p.event_id = @EventId AND (@Status IS NULL OR p.status = @Status)", args);
            return new PagedResponse<Photo> { Items = items.ToList(), Page = page, PageSize = pageSize, Total = total };
        }

        public async Task<Photo?> GetPhotoByIdAsync(ulong photoId)
        {
            using var conn = _db.CreateConnection();
            return await conn.QueryFirstOrDefaultAsync<Photo>(PhotoSelect + " WHERE p.photo_id = @PhotoId", new { PhotoId = photoId });
        }

        public async Task<List<Photo>> GetPhotosByIdsAsync(IEnumerable<ulong> photoIds)
        {
            var ids = photoIds.Distinct().ToArray();
            if (ids.Length == 0) return new();
            using var conn = _db.CreateConnection();
            return (await conn.QueryAsync<Photo>(PhotoSelect + " WHERE p.photo_id IN @Ids", new { Ids = ids })).ToList();
        }

        /// <summary>
        /// Validate -> compress + thumbnail -> save -> DB row (Processing) ->
        /// Python face analysis -> faces rows -> Completed / Failed.
        /// </summary>
        public async Task<UploadResultItem> UploadAsync(IFormFile file, ulong eventId, ulong uploadedBy)
        {
            await using var stream = file.OpenReadStream();
            return await UploadAsync(stream, file.FileName, file.Length, eventId, uploadedBy);
        }

        /// <summary>
        /// The same pipeline for any source (a browser upload, a Google Drive file).
        /// sourceRef (e.g. "gdrive:&lt;fileId&gt;") is stored in photos.source_ref so the
        /// same file isn't imported into an event twice.
        /// </summary>
        public async Task<UploadResultItem> UploadAsync(Stream content, string fileName, long length, ulong eventId, ulong uploadedBy, string? sourceRef = null)
        {
            var result = new UploadResultItem { FileName = fileName };
            var ext = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant();
            if (!(await _settings.AllowedImageTypesAsync()).Contains(ext))
            {
                result.Status = "Rejected";
                result.Error = $"File type .{ext} is not allowed";
                return result;
            }
            if (length == 0 || length > await _settings.MaxUploadBytesAsync())
            {
                result.Status = "Rejected";
                result.Error = length == 0 ? "File is empty" : "File is larger than the upload limit";
                return result;
            }

            ProcessedImage img;
            try
            {
                img = await _storage.ProcessAsync(content);
            }
            catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
            {
                result.Status = "Rejected";
                result.Error = "Not a readable image";
                return result;
            }

            var stored = $"{Guid.NewGuid():N}.jpg";
            var filePath = await _storage.SaveAsync($"photos/{eventId}", stored, img.Compressed);
            var thumbPath = await _storage.SaveAsync($"thumbnails/{eventId}", stored, img.Thumbnail);

            ulong photoId;
            using (var conn = _db.CreateConnection())
            {
                // source_ref is only written for imports, so plain uploads don't depend on that column.
                var (col, val) = sourceRef == null ? ("", "") : (", source_ref", ", @SourceRef");
                photoId = await conn.QueryFirstAsync<ulong>($@"
                    INSERT INTO photos (event_id, original_file_name, stored_file_name, file_path, thumbnail_path,
                                        file_size, mime_type, width, height, status, uploaded_by{col})
                    VALUES (@EventId, @OriginalFileName, @StoredFileName, @FilePath, @ThumbnailPath,
                            @FileSize, 'image/jpeg', @Width, @Height, 'Processing', @UploadedBy{val});
                    SELECT LAST_INSERT_ID();",
                    new
                    {
                        EventId = eventId,
                        OriginalFileName = Truncate(Path.GetFileName(fileName), 255),
                        StoredFileName = stored,
                        FilePath = filePath,
                        ThumbnailPath = thumbPath,
                        FileSize = (ulong)img.Compressed.Length,
                        Width = (uint)img.Width,
                        Height = (uint)img.Height,
                        UploadedBy = uploadedBy,
                        SourceRef = sourceRef,
                    });
            }
            result.PhotoId = photoId;
            result.ThumbnailUrl = Urls.PhotoThumbnail(photoId);
            return await AnalyzeAndFinishAsync(photoId, img.Compressed, (uint)img.Width, (uint)img.Height, result);
        }

        public async Task<HashSet<string>> ExistingSourceRefsAsync(ulong eventId, IEnumerable<string> sourceRefs)
        {
            var refs = sourceRefs.Distinct().ToArray();
            if (refs.Length == 0) return new();
            using var conn = _db.CreateConnection();
            return (await conn.QueryAsync<string>(
                "SELECT source_ref FROM photos WHERE event_id=@EventId AND source_ref IN @Refs",
                new { EventId = eventId, Refs = refs })).ToHashSet();
        }

        public async Task<UploadResultItem> ReanalyzeAsync(Photo photo)
        {
            var result = new UploadResultItem { FileName = photo.OriginalFileName, PhotoId = photo.PhotoId, ThumbnailUrl = Urls.PhotoThumbnail(photo.PhotoId) };
            if (!_storage.Exists(photo.FilePath))
            {
                await SetStatusAsync(photo.PhotoId, "Failed", 0, "Stored image file is missing");
                result.Status = "Failed";
                result.Error = "Stored image file is missing";
                return result;
            }
            await SetStatusAsync(photo.PhotoId, "Processing", photo.FaceCount, null);
            var bytes = await File.ReadAllBytesAsync(_storage.Resolve(photo.FilePath));
            return await AnalyzeAndFinishAsync(photo.PhotoId, bytes, photo.Width ?? 0, photo.Height ?? 0, result);
        }

        private async Task<UploadResultItem> AnalyzeAndFinishAsync(ulong photoId, byte[] jpeg, uint w, uint h, UploadResultItem result)
        {
            var ai = await _ai.AnalyzeAsync(jpeg);
            if (!ai.Ok)
            {
                // "No face" is a normal outcome for a photo (scenery, backs of heads);
                // only a broken/unreachable engine marks the photo Failed.
                if (ai.Error is AiErrorKind.NoFace or AiErrorKind.FaceTooSmall)
                {
                    await _faces.ReplaceFacesAsync(photoId, w, h, Array.Empty<AiFace>());
                    await SetStatusAsync(photoId, "Completed", 0, null);
                    result.Status = "Completed";
                    return result;
                }
                await SetStatusAsync(photoId, "Failed", 0, ai.Message);
                result.Status = "Failed";
                result.Error = ai.Message;
                return result;
            }
            try
            {
                var saved = await _faces.ReplaceFacesAsync(photoId, w, h, ai.Value!.Faces);
                await SetStatusAsync(photoId, "Completed", saved, null);
                result.Status = "Completed";
                result.FaceCount = saved;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Saving faces failed for photo {PhotoId}", photoId);
                await SetStatusAsync(photoId, "Failed", 0, "Saving detected faces failed");
                result.Status = "Failed";
                result.Error = "Saving detected faces failed";
            }
            return result;
        }

        private async Task SetStatusAsync(ulong photoId, string status, int faceCount, string? error)
        {
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync(@"
                UPDATE photos SET status=@Status, face_count=@FaceCount, error_message=@Error,
                       processed_at = CASE WHEN @Status IN ('Completed','Failed') THEN NOW() ELSE processed_at END
                WHERE photo_id=@PhotoId",
                new { Status = status, FaceCount = faceCount, Error = error, PhotoId = photoId });
        }

        public async Task<bool> DeletePhotoAsync(ulong photoId)
        {
            var photo = await GetPhotoByIdAsync(photoId);
            if (photo == null) return false;
            using var conn = _db.CreateConnection();
            // faces, search_matches and downloads rows go with it (ON DELETE CASCADE)
            await conn.ExecuteAsync("DELETE FROM photos WHERE photo_id=@PhotoId", new { PhotoId = photoId });
            _storage.Delete(photo.FilePath);
            _storage.Delete(photo.ThumbnailPath);
            return true;
        }

        private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];
    }
}
