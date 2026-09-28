using genisis_Hub.Helpers;
using genisis_Hub.Models.Requests;
using genisis_Hub.Models.Responses;
using genisis_Hub.Services;
using Microsoft.AspNetCore.Authorization;
using MySqlConnector;
using Microsoft.AspNetCore.Mvc;

namespace genisis_Hub.Controllers
{
    /// <summary>
    /// The Event Admin console. An event admin only ever sees events that
    /// have a row in event_admins for them, limited by that row's can_* flags.
    /// </summary>
    [ApiController]
    [Route("api/eventadmin")]
    [Authorize(Roles = "EventAdmin,SuperAdmin")]
    public class EventAdminController : ControllerBase
    {
        private readonly IEventService _events;
        private readonly IPhotoService _photos;
        private readonly IDownloadService _downloads;
        private readonly AccessService _access;
        private readonly AnalyticsService _analytics;
        private readonly ActivityLogService _log;
        private readonly GoogleDriveService _drive;
        private readonly SettingsService _settings;

        public EventAdminController(IEventService events, IPhotoService photos, IDownloadService downloads,
            AccessService access, AnalyticsService analytics, ActivityLogService log, GoogleDriveService drive, SettingsService settings)
        {
            _events = events; _photos = photos; _downloads = downloads; _access = access; _analytics = analytics; _log = log;
            _drive = drive; _settings = settings;
        }

        private async Task<List<ulong>> MyEventIdsAsync()
        {
            var list = User.IsSuperAdmin()
                ? await _events.GetAllEventsAsync()
                : await _events.GetEventsByAdminAsync(JwtHelper.GetUserId(User));
            return list.Select(e => e.EventId).ToList();
        }

        // GET api/eventadmin/myevents
        [HttpGet("myevents")]
        public async Task<IActionResult> MyEvents()
        {
            var userId = JwtHelper.GetUserId(User);
            var list = User.IsSuperAdmin() ? await _events.GetAllEventsAsync() : await _events.GetEventsByAdminAsync(userId);
            var perms = (await _events.GetAssignmentsForUsersAsync(new[] { userId })).ToDictionary(a => a.EventId);
            return Ok(ApiResponse<object>.Ok(list.Select(e =>
            {
                var r = EventResponse.From(e);
                if (perms.TryGetValue(e.EventId, out var a))
                    r.MyPermissions = new AssignedEventBrief { EventId = a.EventId, EventName = a.EventName, Status = a.Status, CanView = a.CanView, CanUpload = a.CanUpload, CanDelete = a.CanDelete, CanManage = a.CanManage };
                return r;
            })));
        }

        // GET api/eventadmin/dashboard?days=30  -- totals + charts across MY events + per-event stats
        [HttpGet("dashboard")]
        public async Task<IActionResult> Dashboard([FromQuery] int days = 30)
        {
            var ids = await MyEventIdsAsync();
            var perEvent = new List<EventStatsResponse>();
            foreach (var id in ids) perEvent.Add(await _analytics.EventStatsAsync(id));
            return Ok(ApiResponse<object>.Ok(new
            {
                analytics = await _analytics.AnalyticsAsync(days, ids),
                events = perEvent,
            }));
        }

        // GET api/eventadmin/{eventId}/permissions  -- my own permissions on this event
        [HttpGet("{eventId:long}/permissions")]
        public async Task<IActionResult> MyPermissions(ulong eventId)
        {
            var perms = await _access.PermissionsAsync(eventId, User);
            if (perms == null) return NotFound(ApiResponse<object>.Fail("Not assigned to this event"));
            return Ok(ApiResponse<object>.Ok(new { eventId, perms.CanView, perms.CanUpload, perms.CanDelete, perms.CanManage }));
        }

        // GET api/eventadmin/{eventId}/photos?status=Failed&page=1&pageSize=60
        [HttpGet("{eventId:long}/photos")]
        public async Task<IActionResult> GetPhotos(ulong eventId, [FromQuery] string? status = null, [FromQuery] int page = 1, [FromQuery] int pageSize = 60)
        {
            if (!await _access.CanAsync(eventId, User, p => p.CanView)) return Forbid();
            var paged = await _photos.GetPhotosByEventAsync(eventId, status, page, pageSize);
            return Ok(ApiResponse<object>.Ok(new PagedResponse<PhotoResponse>
            {
                Items = paged.Items.Select(PhotoResponse.From).ToList(), Page = paged.Page, PageSize = paged.PageSize, Total = paged.Total,
            }));
        }

        // POST api/eventadmin/{eventId}/photos  (multipart "files", several per request)
        [HttpPost("{eventId:long}/photos")]
        [RequestSizeLimit(500L * 1024 * 1024)]
        public async Task<IActionResult> UploadPhotos(ulong eventId, [FromForm] List<IFormFile> files)
        {
            if (files == null || files.Count == 0) return BadRequest(ApiResponse<object>.Fail("No files provided"));
            if (!await _access.CanAsync(eventId, User, p => p.CanUpload)) return Forbid();
            if (await _events.GetEventByIdAsync(eventId) == null) return NotFound(ApiResponse<object>.Fail("Event not found"));

            var userId = JwtHelper.GetUserId(User);
            var results = new List<UploadResultItem>();
            foreach (var file in files) results.Add(await _photos.UploadAsync(file, eventId, userId));
            await _log.LogAsync(userId, eventId, "PHOTOS_UPLOADED", $"{results.Count(r => r.PhotoId != null)} of {files.Count} photo(s) stored");
            return Ok(ApiResponse<object>.Ok(results, $"{results.Count(r => r.Status == "Completed")} of {files.Count} photo(s) processed"));
        }

        // ── Google Drive import ────────────────────────────────────────────────
        // 1. POST .../drive/list   { url, includeSubfolders }  -> the photos in that folder
        // 2. POST .../drive/import { files: [ ...up to 10 ] }  -> each downloaded + indexed like an upload
        // The browser calls (2) a few files at a time, so a big folder never
        // becomes one long request, and shows progress as it goes.

        private const string DriveRefPrefix = "gdrive:";
        private const string SourceRefMissing = "The database is missing photos.source_ref. Run the Google Drive SQL update in MySQL, then try again.";

        /// <summary>Photo files the pipeline accepts: by extension, or by MIME type when the name has none.</summary>
        private static string? PhotoName(string name, string mime, HashSet<string> allowed)
        {
            var ext = Path.GetExtension(name).TrimStart('.').ToLowerInvariant();
            if (allowed.Contains(ext)) return name;
            var byMime = mime switch { "image/jpeg" => "jpg", "image/png" => "png", "image/webp" => "webp", _ => null };
            return byMime != null && allowed.Contains(byMime) && ext == "" ? $"{name}.{byMime}" : null;
        }

        // POST api/eventadmin/{eventId}/drive/list
        [HttpPost("{eventId:long}/drive/list")]
        public async Task<IActionResult> DriveList(ulong eventId, [FromBody] DriveListRequest request, CancellationToken ct)
        {
            if (!await _access.CanAsync(eventId, User, p => p.CanUpload)) return Forbid();
            var link = GoogleDriveService.Parse(request.Url);
            if (link == null) return BadRequest(ApiResponse<object>.Fail("That doesn’t look like a Google Drive link. Copy the link from Drive’s “Share” button."));
            try
            {
                var info = await _drive.GetInfoAsync(link, ct);
                var allowed = await _settings.AllowedImageTypesAsync();
                List<DriveFile> all;
                var truncated = false;
                if (info.IsFolder) (all, truncated) = await _drive.ListAsync(link.Id, info.ResourceKey, request.IncludeSubfolders, ct);
                else all = new() { new DriveFile(link.Id, info.Name, "", info.MimeType, info.Size, info.ResourceKey) };

                var photos = all.Select(f => (File: f, Name: PhotoName(f.Name, f.MimeType, allowed))).Where(x => x.Name != null).ToList();
                HashSet<string> existing;
                try { existing = await _photos.ExistingSourceRefsAsync(eventId, photos.Select(x => DriveRefPrefix + x.File.Id)); }
                catch (MySqlException ex) when (ex.ErrorCode == MySqlErrorCode.BadFieldError) { return StatusCode(500, ApiResponse<object>.Fail(SourceRefMissing)); }

                return Ok(ApiResponse<object>.Ok(new
                {
                    name = info.Name,
                    isFolder = info.IsFolder,
                    truncated,
                    skipped = all.Count - photos.Count, // not photos (videos, docs, HEIC...)
                    files = photos.Select(x => new
                    {
                        id = x.File.Id,
                        name = x.Name,
                        path = x.File.Path,
                        size = x.File.Size,
                        resourceKey = x.File.ResourceKey,
                        alreadyImported = existing.Contains(DriveRefPrefix + x.File.Id),
                    }),
                }));
            }
            catch (DriveException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
            catch (HttpRequestException) { return StatusCode(503, ApiResponse<object>.Fail("Couldn’t reach Google Drive. Check the server’s internet connection and try again.")); }
            catch (TaskCanceledException) when (!ct.IsCancellationRequested) { return StatusCode(504, ApiResponse<object>.Fail("Google Drive took too long to answer. Try again.")); }
        }

        // POST api/eventadmin/{eventId}/drive/import
        [HttpPost("{eventId:long}/drive/import")]
        public async Task<IActionResult> DriveImport(ulong eventId, [FromBody] DriveImportRequest request, CancellationToken ct)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Send 1-10 files per request"));
            if (!await _access.CanAsync(eventId, User, p => p.CanUpload)) return Forbid();
            if (await _events.GetEventByIdAsync(eventId) == null) return NotFound(ApiResponse<object>.Fail("Event not found"));

            HashSet<string> existing;
            try { existing = await _photos.ExistingSourceRefsAsync(eventId, request.Files.Select(f => DriveRefPrefix + f.Id)); }
            catch (MySqlException ex) when (ex.ErrorCode == MySqlErrorCode.BadFieldError) { return StatusCode(500, ApiResponse<object>.Fail(SourceRefMissing)); }

            var userId = JwtHelper.GetUserId(User);
            var maxBytes = await _settings.MaxUploadBytesAsync();
            var results = new List<UploadResultItem>();
            foreach (var f in request.Files)
            {
                var sourceRef = DriveRefPrefix + f.Id;
                if (existing.Contains(sourceRef))
                {
                    results.Add(new UploadResultItem { FileName = f.Name, Status = "Rejected", Error = "Already in this event" });
                    continue;
                }
                try
                {
                    await using var data = await _drive.DownloadAsync(f.Id, f.ResourceKey, maxBytes, ct);
                    results.Add(await _photos.UploadAsync(data, f.Name, data.Length, eventId, userId, sourceRef));
                    existing.Add(sourceRef); // the same id twice in one batch
                }
                catch (DriveException ex) { results.Add(new UploadResultItem { FileName = f.Name, Status = "Rejected", Error = ex.Message }); }
                catch (HttpRequestException) { results.Add(new UploadResultItem { FileName = f.Name, Status = "Failed", Error = "Couldn’t download from Google Drive" }); }
                catch (TaskCanceledException) when (!ct.IsCancellationRequested) { results.Add(new UploadResultItem { FileName = f.Name, Status = "Failed", Error = "Google Drive download timed out" }); }
            }
            await _log.LogAsync(userId, eventId, "PHOTOS_IMPORTED_DRIVE", $"{results.Count(r => r.PhotoId != null)} of {request.Files.Count} photo(s) imported from Google Drive");
            return Ok(ApiResponse<object>.Ok(results, $"{results.Count(r => r.Status == "Completed")} of {request.Files.Count} photo(s) processed"));
        }

        // POST api/eventadmin/{eventId}/photos/{photoId}/reanalyze
        [HttpPost("{eventId:long}/photos/{photoId:long}/reanalyze")]
        public async Task<IActionResult> Reanalyze(ulong eventId, ulong photoId)
        {
            if (!await _access.CanAsync(eventId, User, p => p.CanUpload || p.CanManage)) return Forbid();
            var photo = await _photos.GetPhotoByIdAsync(photoId);
            if (photo == null || photo.EventId != eventId) return NotFound(ApiResponse<object>.Fail("Photo not found"));
            var r = await _photos.ReanalyzeAsync(photo);
            return Ok(ApiResponse<object>.Ok(r, r.Status == "Completed" ? $"{r.FaceCount} face(s) found" : r.Error ?? "Analysis failed"));
        }

        // POST api/eventadmin/{eventId}/photos/reanalyze-failed  -- retry every Failed photo of the event
        [HttpPost("{eventId:long}/photos/reanalyze-failed")]
        public async Task<IActionResult> ReanalyzeFailed(ulong eventId)
        {
            if (!await _access.CanAsync(eventId, User, p => p.CanUpload || p.CanManage)) return Forbid();
            var failed = await _photos.GetPhotosByEventAsync(eventId, "Failed", 1, 500);
            var results = new List<UploadResultItem>();
            foreach (var photo in failed.Items) results.Add(await _photos.ReanalyzeAsync(photo));
            return Ok(ApiResponse<object>.Ok(results, $"{results.Count(r => r.Status == "Completed")} of {results.Count} recovered"));
        }

        // DELETE api/eventadmin/{eventId}/photos/{photoId}
        [HttpDelete("{eventId:long}/photos/{photoId:long}")]
        public async Task<IActionResult> DeletePhoto(ulong eventId, ulong photoId)
        {
            if (!await _access.CanAsync(eventId, User, p => p.CanDelete)) return Forbid();
            var photo = await _photos.GetPhotoByIdAsync(photoId);
            if (photo == null || photo.EventId != eventId) return NotFound(ApiResponse<object>.Fail("Photo not found"));
            await _photos.DeletePhotoAsync(photoId);
            await _log.LogAsync(JwtHelper.GetUserId(User), eventId, "PHOTO_DELETED", $"Photo {photoId}");
            return Ok(ApiResponse.Ok("Photo deleted"));
        }

        // POST api/eventadmin/{eventId}/photos/bulk-delete   { "photoIds": [..] }
        [HttpPost("{eventId:long}/photos/bulk-delete")]
        public async Task<IActionResult> BulkDelete(ulong eventId, [FromBody] PhotoIdsRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid input"));
            if (!await _access.CanAsync(eventId, User, p => p.CanDelete)) return Forbid();
            var deleted = 0;
            foreach (var photo in await _photos.GetPhotosByIdsAsync(request.PhotoIds))
                if (photo.EventId == eventId && await _photos.DeletePhotoAsync(photo.PhotoId)) deleted++;
            await _log.LogAsync(JwtHelper.GetUserId(User), eventId, "PHOTOS_DELETED", $"{deleted} photo(s)");
            return Ok(ApiResponse<object>.Ok(new { deleted }, $"{deleted} photo(s) deleted"));
        }

        // GET api/eventadmin/{eventId}/downloads  -- download log
        [HttpGet("{eventId:long}/downloads")]
        public async Task<IActionResult> Downloads(ulong eventId)
        {
            if (!await _access.CanAsync(eventId, User, p => p.CanView)) return Forbid();
            return Ok(ApiResponse<object>.Ok(await _downloads.GetDownloadsByEventAsync(eventId)));
        }
    }
}
