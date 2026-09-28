using genisis_Hub.Helpers;
using genisis_Hub.Models;
using genisis_Hub.Models.Requests;
using genisis_Hub.Models.Responses;
using genisis_Hub.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SixLabors.ImageSharp;

namespace genisis_Hub.Controllers
{
    [ApiController]
    [Route("api/events")]
    public class EventController : ControllerBase
    {
        private readonly IEventService _events;
        private readonly AccessService _access;
        private readonly AnalyticsService _analytics;
        private readonly ImageStorage _images;
        private readonly ActivityLogService _log;

        public EventController(IEventService events, AccessService access, AnalyticsService analytics, ImageStorage images, ActivityLogService log)
        {
            _events = events; _access = access; _analytics = analytics; _images = images; _log = log;
        }

        /// <summary>Guests / anonymous see Active+Completed events; admins see what they manage.</summary>
        private async Task<bool> CanSeeAsync(Event ev) =>
            AccessService.GuestVisibleStatuses.Contains(ev.Status) || await _access.CanAsync(ev.EventId, User, p => p.CanView);

        // GET api/events?status=Active
        //   SuperAdmin: all (optional status filter) | EventAdmin: assigned | Guest/anonymous: Active + Completed
        [HttpGet]
        public async Task<IActionResult> GetAll([FromQuery] string? status = null)
        {
            List<Event> list;
            if (User.IsSuperAdmin()) list = await _events.GetAllEventsAsync(status);
            else if (User.IsInRole(Roles.EventAdmin)) list = await _events.GetEventsByAdminAsync(JwtHelper.GetUserId(User));
            else list = await _events.GetEventsByStatusesAsync(AccessService.GuestVisibleStatuses);
            if (status != null) list = list.Where(e => e.Status == status).ToList();
            return Ok(ApiResponse<object>.Ok(list.Select(EventResponse.From)));
        }

        // GET api/events/my  -- EventAdmin: assigned events with own permissions
        [HttpGet("my")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> MyEvents()
        {
            var userId = JwtHelper.GetUserId(User);
            if (User.IsSuperAdmin())
                return Ok(ApiResponse<object>.Ok((await _events.GetAllEventsAsync()).Select(EventResponse.From)));
            var events = await _events.GetEventsByAdminAsync(userId);
            var perms = (await _events.GetAssignmentsForUsersAsync(new[] { userId })).ToDictionary(a => a.EventId);
            return Ok(ApiResponse<object>.Ok(events.Select(e =>
            {
                var r = EventResponse.From(e);
                if (perms.TryGetValue(e.EventId, out var a))
                    r.MyPermissions = new AssignedEventBrief { EventId = a.EventId, EventName = a.EventName, Status = a.Status, CanView = a.CanView, CanUpload = a.CanUpload, CanDelete = a.CanDelete, CanManage = a.CanManage };
                return r;
            })));
        }

        // GET api/events/{eventCode}
        [HttpGet("{eventCode}")]
        public async Task<IActionResult> GetByCode(string eventCode)
        {
            var ev = await _events.GetEventByCodeAsync(eventCode);
            if (ev == null || !await CanSeeAsync(ev)) return NotFound(ApiResponse<object>.Fail("Event not found"));
            return Ok(ApiResponse<object>.Ok(EventResponse.From(ev)));
        }

        // GET api/events/id/{id}
        [HttpGet("id/{id:long}")]
        public async Task<IActionResult> GetById(ulong id)
        {
            var ev = await _events.GetEventByIdAsync(id);
            if (ev == null || !await CanSeeAsync(ev)) return NotFound(ApiResponse<object>.Fail("Event not found"));
            return Ok(ApiResponse<object>.Ok(EventResponse.From(ev)));
        }

        // POST api/events  -- SuperAdmin
        [HttpPost]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> Create([FromBody] CreateEventRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid input"));
            if (await _events.GetEventByCodeAsync(request.EventCode) != null)
                return Conflict(ApiResponse<object>.Fail("That event code is already in use"));
            var userId = JwtHelper.GetUserId(User);
            ulong eventId;
            try { eventId = await _events.CreateEventAsync(request, userId); }
            catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
            var created = await _events.GetEventByIdAsync(eventId);
            await _log.LogAsync(userId, eventId, "EVENT_CREATED", request.EventName);
            return CreatedAtAction(nameof(GetById), new { id = eventId }, ApiResponse<object>.Ok(EventResponse.From(created!), "Event created"));
        }

        // PUT api/events/{id}  -- SuperAdmin, or event admin with can_manage
        [HttpPut("{id:long}")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> Update(ulong id, [FromBody] UpdateEventRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid input"));
            if (!await _access.CanAsync(id, User, p => p.CanManage)) return Forbid();
            bool ok;
            try { ok = await _events.UpdateEventAsync(id, request); }
            catch (ArgumentException ex) { return BadRequest(ApiResponse<object>.Fail(ex.Message)); }
            if (!ok) return NotFound(ApiResponse<object>.Fail("Event not found"));
            await _log.LogAsync(JwtHelper.GetUserId(User), id, "EVENT_UPDATED", request.EventName);
            return Ok(ApiResponse<object>.Ok(EventResponse.From((await _events.GetEventByIdAsync(id))!), "Event updated"));
        }

        // PATCH api/events/{id}/status  { "status": "Archived" }
        [HttpPatch("{id:long}/status")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> SetStatus(ulong id, [FromBody] UpdateStatusRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Status must be Draft, Active, Completed or Archived"));
            if (!await _access.CanAsync(id, User, p => p.CanManage)) return Forbid();
            if (!await _events.UpdateStatusAsync(id, request.Status)) return NotFound(ApiResponse<object>.Fail("Event not found"));
            await _log.LogAsync(JwtHelper.GetUserId(User), id, "EVENT_STATUS", request.Status);
            return Ok(ApiResponse.Ok($"Event is now {request.Status}"));
        }

        // POST api/events/{id}/cover  (multipart "file") -- stored compressed
        [HttpPost("{id:long}/cover")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        [RequestSizeLimit(30 * 1024 * 1024)]
        public async Task<IActionResult> UploadCover(ulong id, IFormFile file)
        {
            if (!await _access.CanAsync(id, User, p => p.CanManage)) return Forbid();
            var ev = await _events.GetEventByIdAsync(id);
            if (ev == null) return NotFound(ApiResponse<object>.Fail("Event not found"));
            if (file == null || file.Length == 0) return BadRequest(ApiResponse<object>.Fail("No file provided"));
            ProcessedImage img;
            try
            {
                await using var s = file.OpenReadStream();
                img = await _images.ProcessAsync(s, maxSide: 1920);
            }
            catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
            {
                return BadRequest(ApiResponse<object>.Fail("Not a readable image"));
            }
            var path = await _images.SaveAsync("covers", $"{id}_{Guid.NewGuid():N}.jpg", img.Compressed);
            _images.Delete(ev.CoverImage);
            await _events.SetCoverAsync(id, path);
            return Ok(ApiResponse<object>.Ok(new { CoverUrl = Urls.EventCover(id, path) }, "Cover updated"));
        }

        // DELETE api/events/{id}/cover
        [HttpDelete("{id:long}/cover")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> DeleteCover(ulong id)
        {
            if (!await _access.CanAsync(id, User, p => p.CanManage)) return Forbid();
            var ev = await _events.GetEventByIdAsync(id);
            if (ev == null) return NotFound(ApiResponse<object>.Fail("Event not found"));
            _images.Delete(ev.CoverImage);
            await _events.SetCoverAsync(id, null);
            return Ok(ApiResponse.Ok("Cover removed"));
        }

        // GET api/events/{id}/cover  -- public for visible events (it's an <img> on event pages)
        [HttpGet("{id:long}/cover")]
        public async Task<IActionResult> GetCover(ulong id)
        {
            var ev = await _events.GetEventByIdAsync(id);
            if (ev == null || string.IsNullOrEmpty(ev.CoverImage) || !await CanSeeAsync(ev) || !_images.Exists(ev.CoverImage))
                return NotFound();
            Response.Headers.CacheControl = "public, max-age=3600";
            return PhysicalFile(_images.Resolve(ev.CoverImage), "image/jpeg");
        }

        // GET api/events/{id}/stats  -- admins of the event
        [HttpGet("{id:long}/stats")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> Stats(ulong id)
        {
            if (!await _access.CanAsync(id, User, p => p.CanView)) return Forbid();
            return Ok(ApiResponse<object>.Ok(await _analytics.EventStatsAsync(id)));
        }

        // GET api/events/{id}/analytics?days=30  -- chart series for one event
        [HttpGet("{id:long}/analytics")]
        [Authorize(Roles = "EventAdmin,SuperAdmin")]
        public async Task<IActionResult> Analytics(ulong id, [FromQuery] int days = 30)
        {
            if (!await _access.CanAsync(id, User, p => p.CanView)) return Forbid();
            return Ok(ApiResponse<object>.Ok(await _analytics.AnalyticsAsync(days, new[] { id })));
        }

        // ── event admins (SuperAdmin) ─────────────────────────────────────────
        // GET api/events/{id}/admins
        [HttpGet("{id:long}/admins")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> GetAdmins(ulong id)
            => Ok(ApiResponse<object>.Ok(await _events.GetEventAdminsAsync(id)));

        // POST api/events/{id}/admins  -- assign (or update) an event admin
        [HttpPost("{id:long}/admins")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> AssignAdmin(ulong id, [FromBody] AssignAdminRequest request)
        {
            if (await _events.GetEventByIdAsync(id) == null) return NotFound(ApiResponse<object>.Fail("Event not found"));
            var assignedBy = JwtHelper.GetUserId(User);
            await _events.AssignAdminAsync(id, request, assignedBy);
            await _log.LogAsync(assignedBy, id, "ADMIN_ASSIGNED", $"User {request.UserId} assigned to event {id}");
            return Ok(ApiResponse.Ok("Admin assigned"));
        }

        // DELETE api/events/{id}/admins/{userId}
        [HttpDelete("{id:long}/admins/{userId:long}")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> RemoveAdmin(ulong id, ulong userId)
        {
            if (!await _events.RemoveAdminAsync(id, userId)) return NotFound(ApiResponse<object>.Fail("Assignment not found"));
            await _log.LogAsync(JwtHelper.GetUserId(User), id, "ADMIN_REMOVED", $"User {userId} removed from event {id}");
            return Ok(ApiResponse.Ok("Admin removed"));
        }

        // PATCH api/events/{id}/admins/{userId}/permissions
        [HttpPatch("{id:long}/admins/{userId:long}/permissions")]
        [Authorize(Roles = "SuperAdmin")]
        public async Task<IActionResult> UpdatePermissions(ulong id, ulong userId, [FromBody] UpdatePermissionsRequest request)
        {
            if (!await _events.UpdateAdminPermissionsAsync(id, userId, request)) return NotFound(ApiResponse<object>.Fail("Assignment not found"));
            await _log.LogAsync(JwtHelper.GetUserId(User), id, "PERMISSIONS_UPDATED", $"User {userId}");
            return Ok(ApiResponse.Ok("Permissions updated"));
        }
    }
}
