using System.Globalization;
using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Helpers;
using genisis_Hub.Models.Requests;
using genisis_Hub.Models.Responses;
using genisis_Hub.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace genisis_Hub.Controllers
{
    [ApiController]
    [Route("api/admin")]
    [Authorize(Roles = "SuperAdmin")]
    public class AdminController : ControllerBase
    {
        private const string UserSelect = @"
            SELECT u.user_id AS UserId, u.full_name AS FullName, u.email AS Email,
                   u.phone AS Phone, u.profile_image AS ProfileImage,
                   u.role_id AS RoleId, r.role_name AS RoleName,
                   u.is_active AS IsActive, u.email_verified AS EmailVerified,
                   u.last_login_at AS LastLoginAt, u.created_at AS CreatedAt
            FROM users u JOIN roles r ON u.role_id = r.role_id";

        private readonly DbContext _db;
        private readonly IAuthService _auth;
        private readonly IEventService _events;
        private readonly AnalyticsService _analytics;
        private readonly ActivityLogService _log;

        public AdminController(DbContext db, IAuthService auth, IEventService events, AnalyticsService analytics, ActivityLogService log)
        {
            _db = db; _auth = auth; _events = events; _analytics = analytics; _log = log;
        }

        // GET api/admin/dashboard
        [HttpGet("dashboard")]
        public async Task<IActionResult> Dashboard()
        {
            using var conn = _db.CreateConnection();
            var stats = await conn.QueryFirstAsync<AdminDashboardResponse>(@"
                SELECT
                    (SELECT COUNT(*) FROM users)    AS TotalUsers,
                    (SELECT COUNT(*) FROM events)   AS TotalEvents,
                    (SELECT COUNT(*) FROM photos)   AS TotalPhotos,
                    (SELECT COUNT(*) FROM searches) AS TotalSearches,
                    (SELECT COUNT(*) FROM faces)    AS TotalFaces,
                    (SELECT COUNT(*) FROM events WHERE status='Active') AS ActiveEvents");
            stats.RecentActivity = (await _log.GetLogsAsync(1, 10)).Select(l => new RecentActivityResponse
            {
                LogId = l.LogId, UserName = l.UserFullName, EventName = l.EventName,
                Action = l.Action, Description = l.Description, CreatedAt = l.CreatedAt,
            }).ToList();
            return Ok(ApiResponse<object>.Ok(stats));
        }

        // GET api/admin/analytics?days=30  -- platform-wide totals + chart series
        [HttpGet("analytics")]
        public async Task<IActionResult> Analytics([FromQuery] int days = 30)
            => Ok(ApiResponse<object>.Ok(await _analytics.AnalyticsAsync(days)));

        // GET api/admin/visitors?q=text  -- everyone who searched, across all events
        [HttpGet("visitors")]
        public async Task<IActionResult> Visitors([FromServices] ISearchService search, [FromQuery] string? q = null)
            => Ok(ApiResponse<object>.Ok(await search.GetVisitorsAsync(null, q)));

        // GET api/admin/users?role=Guest&search=text
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers([FromQuery] string? role = null, [FromQuery] string? search = null)
        {
            using var conn = _db.CreateConnection();
            var users = await conn.QueryAsync<UserResponse>(UserSelect + @"
                WHERE (@Role IS NULL OR r.role_name = @Role)
                  AND (@Search IS NULL OR u.full_name LIKE @Like OR u.email LIKE @Like)
                ORDER BY u.created_at DESC",
                new { Role = role, Search = search, Like = $"%{search}%" });
            return Ok(ApiResponse<object>.Ok(users));
        }

        // GET api/admin/users/{userId}
        [HttpGet("users/{userId:long}")]
        public async Task<IActionResult> GetUser(ulong userId)
        {
            using var conn = _db.CreateConnection();
            var user = await conn.QueryFirstOrDefaultAsync<UserResponse>(UserSelect + " WHERE u.user_id = @UserId", new { UserId = userId });
            if (user == null) return NotFound(ApiResponse<object>.Fail("User not found"));
            return Ok(ApiResponse<object>.Ok(user));
        }

        // POST api/admin/users  -- create an account with a role (e.g. a new Event Admin)
        [HttpPost("users")]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid input"));
            if (request.RoleName is not (Roles.SuperAdmin or Roles.EventAdmin or Roles.Guest))
                return BadRequest(ApiResponse<object>.Fail("RoleName must be SuperAdmin, EventAdmin or Guest"));
            var user = await _auth.CreateUserAsync(request.FullName, request.Email, request.Password, request.Phone, request.RoleName);
            if (user == null) return Conflict(ApiResponse<object>.Fail("Email already registered"));
            await _log.LogAsync(JwtHelper.GetUserId(User), null, "USER_CREATED", $"{user.Email} as {request.RoleName}");
            return Ok(ApiResponse<object>.Ok(new { user.UserId, user.FullName, user.Email, user.RoleName }, "User created"));
        }

        // GET api/admin/event-admins  -- every EventAdmin with the events they're assigned to
        [HttpGet("event-admins")]
        public async Task<IActionResult> EventAdmins()
        {
            using var conn = _db.CreateConnection();
            var admins = (await conn.QueryAsync<EventAdminUserResponse>(UserSelect + " WHERE r.role_name = 'EventAdmin' ORDER BY u.full_name",
                new { })).ToList();
            var assignments = await _events.GetAssignmentsForUsersAsync(admins.Select(a => a.UserId));
            foreach (var a in admins)
                a.AssignedEvents = assignments.Where(x => x.UserId == a.UserId).Select(x => new AssignedEventBrief
                {
                    EventId = x.EventId, EventName = x.EventName, Status = x.Status,
                    CanView = x.CanView, CanUpload = x.CanUpload, CanDelete = x.CanDelete, CanManage = x.CanManage,
                }).ToList();
            return Ok(ApiResponse<object>.Ok(admins));
        }

        // PATCH api/admin/users/{userId}/role
        [HttpPatch("users/{userId:long}/role")]
        public async Task<IActionResult> SetRole(ulong userId, [FromBody] UpdateUserRoleRequest request)
        {
            if (userId == JwtHelper.GetUserId(User)) return BadRequest(ApiResponse<object>.Fail("You can't change your own role"));
            using var conn = _db.CreateConnection();
            if (await conn.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM roles WHERE role_id=@RoleId", new { request.RoleId }) == 0)
                return BadRequest(ApiResponse<object>.Fail("Unknown role"));
            var rows = await conn.ExecuteAsync("UPDATE users SET role_id=@RoleId WHERE user_id=@UserId", new { request.RoleId, UserId = userId });
            if (rows == 0) return NotFound(ApiResponse<object>.Fail("User not found"));
            await _log.LogAsync(JwtHelper.GetUserId(User), null, "ROLE_CHANGED", $"User {userId} role set to {request.RoleId}");
            return Ok(ApiResponse.Ok("Role updated"));
        }

        // PATCH api/admin/users/{userId}/deactivate
        [HttpPatch("users/{userId:long}/deactivate")]
        public async Task<IActionResult> Deactivate(ulong userId)
        {
            if (userId == JwtHelper.GetUserId(User)) return BadRequest(ApiResponse<object>.Fail("You can't deactivate yourself"));
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("UPDATE users SET is_active=0 WHERE user_id=@UserId", new { UserId = userId });
            await _log.LogAsync(JwtHelper.GetUserId(User), null, "USER_DEACTIVATED", $"User {userId} deactivated");
            return Ok(ApiResponse.Ok("User deactivated"));
        }

        // PATCH api/admin/users/{userId}/activate
        [HttpPatch("users/{userId:long}/activate")]
        public async Task<IActionResult> Activate(ulong userId)
        {
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync("UPDATE users SET is_active=1 WHERE user_id=@UserId", new { UserId = userId });
            await _log.LogAsync(JwtHelper.GetUserId(User), null, "USER_ACTIVATED", $"User {userId} activated");
            return Ok(ApiResponse.Ok("User activated"));
        }

        // GET api/admin/settings
        [HttpGet("settings")]
        public async Task<IActionResult> GetSettings()
        {
            using var conn = _db.CreateConnection();
            var settings = await conn.QueryAsync(@"
                SELECT ss.setting_id AS SettingId, ss.setting_key AS SettingKey, ss.setting_value AS SettingValue,
                       ss.description AS Description, ss.updated_by AS UpdatedBy, ss.updated_at AS UpdatedAt,
                       u.full_name AS UpdatedByName
                FROM system_settings ss LEFT JOIN users u ON ss.updated_by = u.user_id
                ORDER BY ss.setting_key");
            return Ok(ApiResponse<object>.Ok(settings));
        }

        // PUT api/admin/settings/{key}
        [HttpPut("settings/{key}")]
        public async Task<IActionResult> UpdateSetting(string key, [FromBody] UpdateSettingRequest request)
        {
            var value = request.SettingValue.Trim();
            // Guard the settings the backend actually reads.
            var error = key switch
            {
                "face_similarity_threshold" when !(decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var t) && t > 0 && t < 1)
                    => "Threshold must be a number between 0 and 1 (e.g. 0.35)",
                "max_upload_size_mb" when !(int.TryParse(value, out var mb) && mb is > 0 and <= 500)
                    => "Upload size must be 1-500 MB",
                "allowed_image_types" when string.IsNullOrWhiteSpace(value)
                    => "List at least one image type",
                _ => null,
            };
            if (error != null) return BadRequest(ApiResponse<object>.Fail(error));

            using var conn = _db.CreateConnection();
            var rows = await conn.ExecuteAsync(
                "UPDATE system_settings SET setting_value=@Value, updated_by=@UserId WHERE setting_key=@Key",
                new { Value = value, UserId = JwtHelper.GetUserId(User), Key = key });
            if (rows == 0) return NotFound(ApiResponse<object>.Fail("Setting not found"));
            SettingsService.Invalidate();
            // never write secrets (the Google API key) into the activity log
            var logged = key.EndsWith("_key") ? (value.Length > 4 ? $"…{value[^4..]}" : "(set)") : value;
            await _log.LogAsync(JwtHelper.GetUserId(User), null, "SETTING_UPDATED", $"{key} = {logged}");
            return Ok(ApiResponse.Ok("Setting updated"));
        }

        // GET api/admin/logs?page=1&pageSize=50
        [HttpGet("logs")]
        public async Task<IActionResult> GetLogs([FromQuery] int page = 1, [FromQuery] int pageSize = 50)
            => Ok(ApiResponse<object>.Ok(await _log.GetLogsAsync(Math.Max(1, page), Math.Clamp(pageSize, 1, 200))));

        // GET api/admin/roles
        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles()
        {
            using var conn = _db.CreateConnection();
            return Ok(ApiResponse<object>.Ok(await conn.QueryAsync(
                "SELECT role_id AS RoleId, role_name AS RoleName, description AS Description FROM roles ORDER BY role_id")));
        }
    }
}
