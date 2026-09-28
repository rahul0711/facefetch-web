using genisis_Hub.Helpers;
using genisis_Hub.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SixLabors.ImageSharp;

namespace genisis_Hub.Controllers
{
    [ApiController]
    [Route("api/search")]
    [Authorize]
    public class SearchController : ControllerBase
    {
        private readonly ISearchService _search;
        private readonly AiFaceClient _ai;
        private readonly AccessService _access;
        private readonly ImageStorage _images;
        private readonly ActivityLogService _log;

        public SearchController(ISearchService search, AiFaceClient ai, AccessService access, ImageStorage images, ActivityLogService log)
        {
            _search = search; _ai = ai; _access = access; _images = images; _log = log;
        }

        // POST api/search/{eventId}
        //   multipart "selfies" (1-5 frames of the same person; the camera sends 3)
        //   or the older single field "selfie".
        // The selfie is only used in memory to get a face signature -- it is never stored.
        [HttpPost("{eventId:long}")]
        [RequestSizeLimit(40 * 1024 * 1024)]
        public async Task<IActionResult> Submit(ulong eventId, [FromForm] List<IFormFile>? selfies, IFormFile? selfie)
        {
            var files = (selfies ?? new()).Where(f => f.Length > 0).ToList();
            if (selfie is { Length: > 0 }) files.Add(selfie);
            if (files.Count == 0) return BadRequest(ApiResponse<object>.Fail("No selfie provided"));

            var canAdmin = await _access.CanAsync(eventId, User, p => p.CanView);
            if (!canAdmin && !await _access.GuestCanOpenEventAsync(eventId))
                return NotFound(ApiResponse<object>.Fail("Event not found"));

            var userId = JwtHelper.GetUserId(User);
            var frames = new List<(byte[] bytes, string name)>();
            foreach (var f in files.Take(5))
            {
                try
                {
                    await using var s = f.OpenReadStream();
                    frames.Add(((await _images.ProcessAsync(s, maxSide: 1600)).Compressed, "selfie.jpg"));
                }
                catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
                {
                    // skip unreadable frames; fail below if none are usable
                }
            }
            if (frames.Count == 0)
                return UnprocessableEntity(ApiResponse<object>.Fail("That file isn't a photo we can read. Try a JPG or PNG."));

            var ai = await _ai.QueryAsync(frames);
            if (!ai.Ok)
            {
                if (ai.Error == AiErrorKind.Unavailable)
                    return StatusCode(503, ApiResponse<object>.Fail("Face search is temporarily unavailable. Please try again shortly."));
                var failed = await _search.RecordFailedSearchAsync(eventId, userId == 0 ? null : userId, ai.Message ?? "No face detected");
                await _log.LogAsync(userId, eventId, "SEARCH_NO_FACE", ai.Message, HttpContext.ClientIp(), HttpContext.ClientAgent());
                return UnprocessableEntity(new ApiResponse<object>
                {
                    Success = false,
                    Message = ai.Error == AiErrorKind.FaceTooSmall
                        ? "Your face is a little far away. Move closer and try again."
                        : "We couldn't see a face. Face the camera in good light and try again.",
                    Data = new { failed.SearchId, reason = ai.Error.ToString() },
                });
            }

            var result = await _search.SearchAsync(eventId, userId == 0 ? null : userId, ai.Value!);
            await _log.LogAsync(userId, eventId, "SEARCH_COMPLETED", $"Search returned {result.MatchCount} match(es)",
                HttpContext.ClientIp(), HttpContext.ClientAgent());
            return Ok(ApiResponse<object>.Ok(result, $"Search complete — {result.MatchCount} photo(s) found"));
        }

        // GET api/search/{searchId}/results  -- the owner, or an admin of the event
        [HttpGet("{searchId:long}/results")]
        public async Task<IActionResult> Results(ulong searchId)
        {
            if (!await _access.CanViewSearchAsync(searchId, User)) return NotFound(ApiResponse<object>.Fail("Search not found"));
            var result = await _search.GetSearchResultsAsync(searchId);
            return result == null ? NotFound(ApiResponse<object>.Fail("Search not found")) : Ok(ApiResponse<object>.Ok(result));
        }

        // GET api/search/my  -- my past searches
        [HttpGet("my")]
        public async Task<IActionResult> MySearches()
            => Ok(ApiResponse<object>.Ok(await _search.GetSearchesByUserAsync(JwtHelper.GetUserId(User))));

        // GET api/search/my/latest/{eventId}  -- my latest successful search in an event (results page on reload)
        [HttpGet("my/latest/{eventId:long}")]
        public async Task<IActionResult> MyLatest(ulong eventId)
        {
            var r = await _search.GetLatestForEventAsync(JwtHelper.GetUserId(User), eventId);
            return r == null ? NotFound(ApiResponse<object>.Fail("No search yet for this event")) : Ok(ApiResponse<object>.Ok(r));
        }

        // GET api/search/my/photos  -- every photo I've been found in, across events
        [HttpGet("my/photos")]
        public async Task<IActionResult> MyPhotos()
            => Ok(ApiResponse<object>.Ok(await _search.GetMyPhotosAsync(JwtHelper.GetUserId(User))));

        // DELETE api/search/my  -- clear my search history
        [HttpDelete("my")]
        public async Task<IActionResult> ClearHistory()
        {
            var userId = JwtHelper.GetUserId(User);
            var n = await _search.ClearHistoryAsync(userId);
            await _log.LogAsync(userId, null, "SEARCH_HISTORY_CLEARED", $"{n} search(es)");
            return Ok(ApiResponse<object>.Ok(new { deleted = n }, "Search history cleared"));
        }

        // GET api/search/event/{eventId}  -- admins of that event
        [HttpGet("event/{eventId:long}")]
        [Authorize(Roles = "SuperAdmin,EventAdmin")]
        public async Task<IActionResult> ByEvent(ulong eventId)
        {
            if (!await _access.CanAsync(eventId, User, p => p.CanView)) return Forbid();
            return Ok(ApiResponse<object>.Ok(await _search.GetSearchesByEventAsync(eventId)));
        }
    }
}
