using genisis_Hub.Helpers;
using genisis_Hub.Models.Requests;
using genisis_Hub.Models.Responses;
using genisis_Hub.Services;
using Microsoft.AspNetCore.Authorization;
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

        public EventAdminController(IEventService events, IPhotoService photos, IDownloadService downloads,
            AccessService access, AnalyticsService analytics, ActivityLogService log)
        {
            _events = events; _photos = photos; _downloads = downloads; _access = access; _analytics = analytics; _log = log;
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
