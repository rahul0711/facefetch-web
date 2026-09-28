using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Models;

namespace genisis_Hub.Services
{
    public class ActivityLogService
    {
        private readonly DbContext _db;
        public ActivityLogService(DbContext db) => _db = db;

        public async Task LogAsync(ulong? userId, ulong? eventId, string action, string? description, string? ip = null, string? ua = null)
        {
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync(@"
                INSERT INTO activity_logs (user_id, event_id, action, description, ip_address, user_agent)
                VALUES (@UserId, @EventId, @Action, @Description, @IpAddress, @UserAgent)",
                new { UserId = userId, EventId = eventId, Action = action, Description = description, IpAddress = ip, UserAgent = ua });
        }

        public async Task<List<ActivityLog>> GetLogsAsync(int page = 1, int pageSize = 50)
        {
            using var conn = _db.CreateConnection();
            var offset = (page - 1) * pageSize;
            var sql = @"SELECT al.*, u.full_name AS UserFullName, e.event_name AS EventName
                        FROM activity_logs al
                        LEFT JOIN users u ON al.user_id = u.user_id
                        LEFT JOIN events e ON al.event_id = e.event_id
                        ORDER BY al.created_at DESC
                        LIMIT @PageSize OFFSET @Offset";
            return (await conn.QueryAsync<ActivityLog>(sql, new { PageSize = pageSize, Offset = offset })).ToList();
        }

        public async Task<List<ActivityLog>> GetLogsByUserAsync(ulong userId)
        {
            using var conn = _db.CreateConnection();
            return (await conn.QueryAsync<ActivityLog>(
                "SELECT * FROM activity_logs WHERE user_id=@UserId ORDER BY created_at DESC LIMIT 100",
                new { UserId = userId })).ToList();
        }
    }
}
