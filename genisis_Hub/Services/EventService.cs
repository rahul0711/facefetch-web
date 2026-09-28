using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Models;
using genisis_Hub.Models.Requests;

namespace genisis_Hub.Services
{
    public interface IEventService
    {
        Task<List<Event>> GetAllEventsAsync(string? status = null);
        Task<List<Event>> GetEventsByStatusesAsync(IEnumerable<string> statuses);
        Task<bool> UpdateStatusAsync(ulong eventId, string status);
        Task<bool> SetCoverAsync(ulong eventId, string? coverPath);
        Task<List<(ulong EventId, string EventName, string Status, bool CanView, bool CanUpload, bool CanDelete, bool CanManage, ulong UserId)>> GetAssignmentsForUsersAsync(IEnumerable<ulong> userIds);
        Task<List<Event>> GetEventsByAdminAsync(ulong userId);
        Task<Event?> GetEventByCodeAsync(string eventCode);
        Task<Event?> GetEventByIdAsync(ulong eventId);
        Task<ulong> CreateEventAsync(CreateEventRequest request, ulong createdBy);
        Task<bool> UpdateEventAsync(ulong eventId, UpdateEventRequest request);
        Task<List<EventAdmin>> GetEventAdminsAsync(ulong eventId);
        Task<bool> AssignAdminAsync(ulong eventId, AssignAdminRequest request, ulong assignedBy);
        Task<bool> RemoveAdminAsync(ulong eventId, ulong userId);
        Task<bool> UpdateAdminPermissionsAsync(ulong eventId, ulong userId, UpdatePermissionsRequest request);
        Task<bool> IsUserAdminOfEventAsync(ulong eventId, ulong userId);
        Task<EventAdmin?> GetEventAdminPermissionsAsync(ulong eventId, ulong userId);
    }

    public class EventService : IEventService
    {
        private readonly DbContext _db;
        public EventService(DbContext db) => _db = db;

        public async Task<List<Event>> GetAllEventsAsync(string? status = null)
        {
            using var conn = _db.CreateConnection();
            var sql = @"SELECT e.*, u.full_name AS CreatedByName,
                               (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.event_id AND p.status = 'Completed') AS PhotoCount
                        FROM events e
                        JOIN users u ON e.created_by = u.user_id
                        WHERE (@Status IS NULL OR e.status = @Status)
                        ORDER BY e.created_at DESC";
            var result = await conn.QueryAsync<Event>(sql, new { Status = status });
            return result.ToList();
        }

        public async Task<List<Event>> GetEventsByStatusesAsync(IEnumerable<string> statuses)
        {
            using var conn = _db.CreateConnection();
            var sql = @"SELECT e.*, u.full_name AS CreatedByName,
                               (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.event_id AND p.status = 'Completed') AS PhotoCount
                        FROM events e
                        JOIN users u ON e.created_by = u.user_id
                        WHERE e.status IN @Statuses
                        ORDER BY e.event_date DESC, e.created_at DESC";
            return (await conn.QueryAsync<Event>(sql, new { Statuses = statuses.ToArray() })).ToList();
        }

        public async Task<bool> UpdateStatusAsync(ulong eventId, string status)
        {
            using var conn = _db.CreateConnection();
            return await conn.ExecuteAsync("UPDATE events SET status=@Status WHERE event_id=@EventId",
                new { Status = status, EventId = eventId }) > 0;
        }

        public async Task<bool> SetCoverAsync(ulong eventId, string? coverPath)
        {
            using var conn = _db.CreateConnection();
            return await conn.ExecuteAsync("UPDATE events SET cover_image=@Cover WHERE event_id=@EventId",
                new { Cover = coverPath, EventId = eventId }) > 0;
        }

        public async Task<List<(ulong EventId, string EventName, string Status, bool CanView, bool CanUpload, bool CanDelete, bool CanManage, ulong UserId)>> GetAssignmentsForUsersAsync(IEnumerable<ulong> userIds)
        {
            var ids = userIds.Distinct().ToArray();
            if (ids.Length == 0) return new();
            using var conn = _db.CreateConnection();
            return (await conn.QueryAsync<(ulong, string, string, bool, bool, bool, bool, ulong)>(@"
                SELECT e.event_id, e.event_name, e.status, ea.can_view, ea.can_upload, ea.can_delete, ea.can_manage, ea.user_id
                FROM event_admins ea JOIN events e ON e.event_id = ea.event_id
                WHERE ea.user_id IN @Ids ORDER BY e.event_date DESC", new { Ids = ids })).ToList();
        }

        public async Task<List<Event>> GetEventsByAdminAsync(ulong userId)
        {
            using var conn = _db.CreateConnection();
            var sql = @"SELECT e.*, u.full_name AS CreatedByName,
                               (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.event_id AND p.status = 'Completed') AS PhotoCount
                        FROM events e
                        JOIN event_admins ea ON e.event_id = ea.event_id
                        JOIN users u ON e.created_by = u.user_id
                        WHERE ea.user_id = @UserId
                        ORDER BY e.created_at DESC";
            var result = await conn.QueryAsync<Event>(sql, new { UserId = userId });
            return result.ToList();
        }

        public async Task<Event?> GetEventByCodeAsync(string eventCode)
        {
            using var conn = _db.CreateConnection();
            var sql = @"SELECT e.*, u.full_name AS CreatedByName,
                               (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.event_id AND p.status = 'Completed') AS PhotoCount
                        FROM events e
                        JOIN users u ON e.created_by = u.user_id
                        WHERE e.event_code = @EventCode";
            return await conn.QueryFirstOrDefaultAsync<Event>(sql, new { EventCode = eventCode });
        }

        public async Task<Event?> GetEventByIdAsync(ulong eventId)
        {
            using var conn = _db.CreateConnection();
            var sql = @"SELECT e.*, u.full_name AS CreatedByName,
                               (SELECT COUNT(*) FROM photos p WHERE p.event_id = e.event_id AND p.status = 'Completed') AS PhotoCount
                        FROM events e
                        JOIN users u ON e.created_by = u.user_id
                        WHERE e.event_id = @EventId";
            return await conn.QueryFirstOrDefaultAsync<Event>(sql, new { EventId = eventId });
        }

        public async Task<ulong> CreateEventAsync(CreateEventRequest request, ulong createdBy)
        {
            using var conn = _db.CreateConnection();
            var sql = @"INSERT INTO events (event_name, event_code, description, event_date, location, status, created_by)
                        VALUES (@EventName, @EventCode, @Description, @EventDate, @Location, @Status, @CreatedBy);
                        SELECT LAST_INSERT_ID();";
            return await conn.QueryFirstAsync<ulong>(sql, new
            {
                request.EventName,
                request.EventCode,
                request.Description,
                EventDate = ParseDate(request.EventDate),
                request.Location,
                request.Status,
                CreatedBy = createdBy
            });
        }

        public async Task<bool> UpdateEventAsync(ulong eventId, UpdateEventRequest request)
        {
            using var conn = _db.CreateConnection();
            var sql = @"UPDATE events SET event_name=@EventName, description=@Description,
                               event_date=@EventDate, location=@Location, status=@Status
                        WHERE event_id=@EventId";
            var rows = await conn.ExecuteAsync(sql, new
            {
                request.EventName,
                request.Description,
                EventDate = ParseDate(request.EventDate),
                request.Location,
                request.Status,
                EventId = eventId
            });
            return rows > 0;
        }

        public async Task<List<EventAdmin>> GetEventAdminsAsync(ulong eventId)
        {
            using var conn = _db.CreateConnection();
            var sql = @"SELECT ea.*, u.full_name AS UserFullName, u.email AS UserEmail,
                               e.event_name AS EventName,
                               a.full_name AS AssignedByName
                        FROM event_admins ea
                        JOIN users u ON ea.user_id = u.user_id
                        JOIN events e ON ea.event_id = e.event_id
                        JOIN users a ON ea.assigned_by = a.user_id
                        WHERE ea.event_id = @EventId";
            var result = await conn.QueryAsync<EventAdmin>(sql, new { EventId = eventId });
            return result.ToList();
        }

        public async Task<bool> AssignAdminAsync(ulong eventId, AssignAdminRequest request, ulong assignedBy)
        {
            using var conn = _db.CreateConnection();
            var sql = @"INSERT INTO event_admins (event_id, user_id, can_view, can_upload, can_delete, can_manage, assigned_by)
                        VALUES (@EventId, @UserId, @CanView, @CanUpload, @CanDelete, @CanManage, @AssignedBy)
                        ON DUPLICATE KEY UPDATE
                            can_view=@CanView, can_upload=@CanUpload, can_delete=@CanDelete,
                            can_manage=@CanManage, assigned_by=@AssignedBy";
            await conn.ExecuteAsync(sql, new
            {
                EventId    = eventId,
                request.UserId,
                request.CanView,
                request.CanUpload,
                request.CanDelete,
                request.CanManage,
                AssignedBy = assignedBy
            });
            return true;
        }

        public async Task<bool> RemoveAdminAsync(ulong eventId, ulong userId)
        {
            using var conn = _db.CreateConnection();
            var rows = await conn.ExecuteAsync(
                "DELETE FROM event_admins WHERE event_id=@EventId AND user_id=@UserId",
                new { EventId = eventId, UserId = userId });
            return rows > 0;
        }

        public async Task<bool> UpdateAdminPermissionsAsync(ulong eventId, ulong userId, UpdatePermissionsRequest request)
        {
            using var conn = _db.CreateConnection();
            var sql = @"UPDATE event_admins SET can_view=@CanView, can_upload=@CanUpload,
                               can_delete=@CanDelete, can_manage=@CanManage
                        WHERE event_id=@EventId AND user_id=@UserId";
            var rows = await conn.ExecuteAsync(sql, new
            {
                request.CanView, request.CanUpload, request.CanDelete, request.CanManage,
                EventId = eventId, UserId = userId
            });
            return rows > 0;
        }

        public async Task<bool> IsUserAdminOfEventAsync(ulong eventId, ulong userId)
        {
            using var conn = _db.CreateConnection();
            var count = await conn.QueryFirstOrDefaultAsync<int>(
                "SELECT COUNT(*) FROM event_admins WHERE event_id=@EventId AND user_id=@UserId",
                new { EventId = eventId, UserId = userId });
            return count > 0;
        }

        public static DateTime? ParseDate(string? s) =>
            string.IsNullOrWhiteSpace(s) ? null
            : DateTime.TryParseExact(s.Trim(), new[] { "yyyy-MM-dd", "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-ddTHH:mm:ss.fffZ" },
                System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var d)
                ? d.Date
                : throw new ArgumentException("EventDate must be in yyyy-MM-dd format");

        public async Task<EventAdmin?> GetEventAdminPermissionsAsync(ulong eventId, ulong userId)
        {
            using var conn = _db.CreateConnection();
            return await conn.QueryFirstOrDefaultAsync<EventAdmin>(
                "SELECT * FROM event_admins WHERE event_id=@EventId AND user_id=@UserId",
                new { EventId = eventId, UserId = userId });
        }
    }
}
