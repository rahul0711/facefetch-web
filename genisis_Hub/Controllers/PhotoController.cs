using genisis_Hub.Helpers;
using genisis_Hub.Models.Requests;
using genisis_Hub.Models.Responses;
using genisis_Hub.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace genisis_Hub.Controllers
{
    [ApiController]
    [Route("api/photos")]
    [Authorize]
    public class PhotoController : ControllerBase
    {
        private const int MaxZipPhotos = 500;
        private readonly IPhotoService _photos;
        private readonly IFaceService _faces;
        private readonly IDownloadService _downloads;
        private readonly AccessService _access;
        private readonly ImageStorage _storage;
        private readonly ActivityLogService _log;

        public PhotoController(IPhotoService photos, IFaceService faces, IDownloadService downloads,
            AccessService access, ImageStorage storage, ActivityLogService log)
        {
            _photos = photos; _faces = faces; _downloads = downloads; _access = access; _storage = storage; _log = log;
        }

        // GET api/photos/event/{eventId}?status=Completed&page=1&pageSize=60  -- admins of the event
        [HttpGet("event/{eventId:long}")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> GetByEvent(ulong eventId, [FromQuery] string? status = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 60)
        {
            if (!await _access.CanAsync(eventId, User, p => p.CanView)) return Forbid();
            var paged = await _photos.GetPhotosByEventAsync(eventId, status, page, pageSize);
            return Ok(ApiResponse<object>.Ok(new PagedResponse<PhotoResponse>
            {
                Items = paged.Items.Select(PhotoResponse.From).ToList(), Page = paged.Page, PageSize = paged.PageSize, Total = paged.Total,
            }));
        }

        // GET api/photos/{photoId}  -- admins get face boxes too
        [HttpGet("{photoId:long}")]
        public async Task<IActionResult> GetById(ulong photoId)
        {
            var photo = await _photos.GetPhotoByIdAsync(photoId);
            if (photo == null || !await _access.CanViewPhotoAsync(photo, User)) return NotFound(ApiResponse<object>.Fail("Photo not found"));
            var r = PhotoResponse.From(photo);
            if (await _access.CanAsync(photo.EventId, User, p => p.CanView))
                r.Faces = (await _faces.GetFacesByPhotoAsync(photoId)).Select(f => FaceBoxResponse.From(f, photo.Width, photo.Height)).ToList();
            return Ok(ApiResponse<object>.Ok(r));
        }

        // GET api/photos/{photoId}/faces  -- admins
        [HttpGet("{photoId:long}/faces")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> Faces(ulong photoId)
        {
            var photo = await _photos.GetPhotoByIdAsync(photoId);
            if (photo == null) return NotFound(ApiResponse<object>.Fail("Photo not found"));
            if (!await _access.CanAsync(photo.EventId, User, p => p.CanView)) return Forbid();
            var faces = await _faces.GetFacesByPhotoAsync(photoId);
            return Ok(ApiResponse<object>.Ok(faces.Select(f => FaceBoxResponse.From(f, photo.Width, photo.Height))));
        }

        // GET api/photos/{photoId}/image      (compressed full image)
        // GET api/photos/{photoId}/thumbnail  (small grid image)
        // For <img src>, the JWT can be passed as ?access_token=... (see Program.cs).
        [HttpGet("{photoId:long}/image")]
        public Task<IActionResult> Image(ulong photoId) => ServeAsync(photoId, thumbnail: false);

        [HttpGet("{photoId:long}/thumbnail")]
        public Task<IActionResult> Thumbnail(ulong photoId) => ServeAsync(photoId, thumbnail: true);

        private async Task<IActionResult> ServeAsync(ulong photoId, bool thumbnail)
        {
            var photo = await _photos.GetPhotoByIdAsync(photoId);
            if (photo == null || !await _access.CanViewPhotoAsync(photo, User)) return NotFound();
            var path = thumbnail && _storage.Exists(photo.ThumbnailPath) ? photo.ThumbnailPath : photo.FilePath;
            if (!_storage.Exists(path)) return NotFound();
            Response.Headers.CacheControl = "private, max-age=86400";
            return PhysicalFile(_storage.Resolve(path!), photo.MimeType ?? "image/jpeg", enableRangeProcessing: true);
        }

        // GET api/photos/{photoId}/download
        [HttpGet("{photoId:long}/download")]
        public async Task<IActionResult> Download(ulong photoId)
        {
            var photo = await _photos.GetPhotoByIdAsync(photoId);
            if (photo == null || !await _access.CanViewPhotoAsync(photo, User) || !_storage.Exists(photo.FilePath))
                return NotFound(ApiResponse<object>.Fail("Photo not found"));
            await _downloads.LogDownloadsAsync(JwtHelper.GetUserId(User), new[] { photo }, "Single", HttpContext.ClientIp(), HttpContext.ClientAgent());
            var name = $"{Path.GetFileNameWithoutExtension(photo.OriginalFileName)}.jpg";
            return PhysicalFile(_storage.Resolve(photo.FilePath), "image/jpeg", name);
        }

        // POST api/photos/download-zip   { "photoIds": [1,2,3] }
        [HttpPost("download-zip")]
        public async Task<IActionResult> DownloadZip([FromBody] PhotoIdsRequest request)
        {
            if (!ModelState.IsValid || request.PhotoIds.Count == 0) return BadRequest(ApiResponse<object>.Fail("No photos specified"));
            if (request.PhotoIds.Count > MaxZipPhotos) return BadRequest(ApiResponse<object>.Fail($"At most {MaxZipPhotos} photos per zip"));

            var photos = new List<Models.Photo>();
            foreach (var p in await _photos.GetPhotosByIdsAsync(request.PhotoIds))
                if (await _access.CanViewPhotoAsync(p, User)) photos.Add(p);
            if (photos.Count == 0) return NotFound(ApiResponse<object>.Fail("No photos found"));

            var zipPath = await _downloads.CreateZipFileAsync(photos);
            await _downloads.LogDownloadsAsync(JwtHelper.GetUserId(User), photos, photos.Count == 1 ? "Single" : "Zip",
                HttpContext.ClientIp(), HttpContext.ClientAgent());
            Response.RegisterForDispose(new TempFile(zipPath));
            return PhysicalFile(zipPath, "application/zip", $"genesis-hub-photos-{DateTime.Now:yyyyMMdd}.zip");
        }

        // POST api/photos/upload/{eventId}  (multipart "files") -- same as POST api/eventadmin/{eventId}/photos
        [HttpPost("upload/{eventId:long}")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        [RequestSizeLimit(500L * 1024 * 1024)]
        public async Task<IActionResult> Upload(ulong eventId, [FromForm] List<IFormFile> files)
        {
            if (files == null || files.Count == 0) return BadRequest(ApiResponse<object>.Fail("No files provided"));
            if (!await _access.CanAsync(eventId, User, p => p.CanUpload)) return Forbid();
            var userId = JwtHelper.GetUserId(User);
            var results = new List<UploadResultItem>();
            foreach (var file in files) results.Add(await _photos.UploadAsync(file, eventId, userId));
            await _log.LogAsync(userId, eventId, "PHOTOS_UPLOADED", $"{results.Count(r => r.PhotoId != null)} of {files.Count} photo(s) stored");
            return Ok(ApiResponse<object>.Ok(results, $"{results.Count(r => r.Status == "Completed")} of {files.Count} photo(s) processed"));
        }

        // POST api/photos/{photoId}/reanalyze  -- run face analysis again (e.g. after a Failed status)
        [HttpPost("{photoId:long}/reanalyze")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> Reanalyze(ulong photoId)
        {
            var photo = await _photos.GetPhotoByIdAsync(photoId);
            if (photo == null) return NotFound(ApiResponse<object>.Fail("Photo not found"));
            if (!await _access.CanAsync(photo.EventId, User, p => p.CanUpload || p.CanManage)) return Forbid();
            var r = await _photos.ReanalyzeAsync(photo);
            return Ok(ApiResponse<object>.Ok(r, r.Status == "Completed" ? $"{r.FaceCount} face(s) found" : r.Error ?? "Analysis failed"));
        }

        // DELETE api/photos/{photoId}
        [HttpDelete("{photoId:long}")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> Delete(ulong photoId)
        {
            var photo = await _photos.GetPhotoByIdAsync(photoId);
            if (photo == null) return NotFound(ApiResponse<object>.Fail("Photo not found"));
            if (!await _access.CanAsync(photo.EventId, User, p => p.CanDelete)) return Forbid();
            await _photos.DeletePhotoAsync(photoId);
            await _log.LogAsync(JwtHelper.GetUserId(User), photo.EventId, "PHOTO_DELETED", $"Photo {photoId} deleted");
            return Ok(ApiResponse.Ok("Photo deleted"));
        }

        // POST api/photos/bulk-delete   { "photoIds": [1,2,3] }
        [HttpPost("bulk-delete")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> BulkDelete([FromBody] PhotoIdsRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid input"));
            var deleted = 0;
            var denied = 0;
            foreach (var photo in await _photos.GetPhotosByIdsAsync(request.PhotoIds))
            {
                if (!await _access.CanAsync(photo.EventId, User, p => p.CanDelete)) { denied++; continue; }
                if (await _photos.DeletePhotoAsync(photo.PhotoId)) deleted++;
            }
            await _log.LogAsync(JwtHelper.GetUserId(User), null, "PHOTOS_DELETED", $"{deleted} photo(s) deleted");
            return Ok(ApiResponse<object>.Ok(new { deleted, denied }, $"{deleted} photo(s) deleted"));
        }

        /// <summary>Deletes the temporary zip once the response has been sent.</summary>
        private sealed class TempFile(string path) : IDisposable
        {
            public void Dispose()
            {
                try { System.IO.File.Delete(path); } catch (IOException) { }
            }
        }
    }
}
