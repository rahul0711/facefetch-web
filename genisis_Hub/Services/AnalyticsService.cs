using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Models.Responses;

namespace genisis_Hub.Services
{
    /// <summary>
    /// Stats and chart data, all derived from the existing tables:
    /// searches, photos, faces, downloads, events, users.
    /// </summary>
    public class AnalyticsService
    {
        private readonly DbContext _db;
        public AnalyticsService(DbContext db) => _db = db;

        public async Task<EventStatsResponse> EventStatsAsync(ulong eventId)
        {
            using var conn = _db.CreateConnection();
            var s = await conn.QueryFirstAsync<EventStatsResponse>(@"
                SELECT @EventId AS EventId,
                  (SELECT COUNT(*) FROM photos WHERE event_id=@EventId)                              AS Photos,
                  (SELECT COUNT(*) FROM photos WHERE event_id=@EventId AND status='Completed')       AS PhotosCompleted,
                  (SELECT COUNT(*) FROM photos WHERE event_id=@EventId AND status='Pending')         AS PhotosPending,
                  (SELECT COUNT(*) FROM photos WHERE event_id=@EventId AND status='Processing')      AS PhotosProcessing,
                  (SELECT COUNT(*) FROM photos WHERE event_id=@EventId AND status='Failed')          AS PhotosFailed,
                  (SELECT COUNT(*) FROM faces f JOIN photos p ON p.photo_id=f.photo_id WHERE p.event_id=@EventId) AS Faces,
                  (SELECT COUNT(*) FROM searches WHERE event_id=@EventId)                            AS Searches,
                  (SELECT COUNT(*) FROM searches WHERE event_id=@EventId AND match_count > 0)        AS SuccessfulSearches,
                  (SELECT COUNT(DISTINCT guest_id) FROM searches WHERE event_id=@EventId AND guest_id IS NOT NULL) AS UniqueVisitors,
                  (SELECT COUNT(*) FROM downloads WHERE event_id=@EventId)                           AS Downloads,
                  (SELECT COALESCE(SUM(file_size),0) FROM photos WHERE event_id=@EventId)            AS StorageBytes",
                new { EventId = eventId });
            return s;
        }

        /// <summary>eventIds = null -> whole platform; otherwise only those events.</summary>
        public async Task<AnalyticsResponse> AnalyticsAsync(int days, IReadOnlyCollection<ulong>? eventIds = null)
        {
            days = Math.Clamp(days, 1, 365);
            var from = DateTime.Today.AddDays(-(days - 1));
            var scoped = eventIds is not null;
            var ids = (eventIds ?? Array.Empty<ulong>()).DefaultIfEmpty(0UL).ToArray(); // IN () is invalid SQL
            var p = new { From = from, Ids = ids };
            string Where(string col) => scoped ? $" AND {col} IN @Ids" : "";

            using var conn = _db.CreateConnection();
            var totals = await conn.QueryFirstAsync(@$"
                SELECT
                  (SELECT COUNT(*) FROM events e WHERE 1=1 {Where("e.event_id")})                                AS events,
                  (SELECT COUNT(*) FROM events e WHERE e.status='Active' {Where("e.event_id")})                   AS activeEvents,
                  (SELECT COUNT(*) FROM photos p WHERE 1=1 {Where("p.event_id")})                                AS photos,
                  (SELECT COUNT(*) FROM faces f JOIN photos p ON p.photo_id=f.photo_id WHERE 1=1 {Where("p.event_id")}) AS faces,
                  (SELECT COUNT(*) FROM searches s WHERE 1=1 {Where("s.event_id")})                              AS searches,
                  (SELECT COUNT(*) FROM searches s WHERE s.match_count > 0 {Where("s.event_id")})                AS successfulSearches,
                  (SELECT COUNT(*) FROM searches s WHERE DATE(s.started_at)=CURDATE() {Where("s.event_id")})     AS searchesToday,
                  (SELECT COUNT(*) FROM searches s WHERE DATE(s.started_at)=CURDATE()-INTERVAL 1 DAY {Where("s.event_id")}) AS searchesYesterday,
                  (SELECT COUNT(DISTINCT s.guest_id) FROM searches s WHERE s.guest_id IS NOT NULL {Where("s.event_id")}) AS uniqueVisitors,
                  (SELECT COUNT(*) FROM downloads d WHERE 1=1 {Where("d.event_id")})                             AS downloads,
                  (SELECT COALESCE(SUM(p.file_size),0) FROM photos p WHERE 1=1 {Where("p.event_id")})            AS storageBytes,
                  (SELECT COUNT(*) FROM users u JOIN roles r ON r.role_id=u.role_id WHERE r.role_name='Guest')      AS guests,
                  (SELECT COUNT(*) FROM users u JOIN roles r ON r.role_id=u.role_id WHERE r.role_name='EventAdmin') AS eventAdmins", p);

            var result = new AnalyticsResponse
            {
                Days = days,
                Totals = ((IDictionary<string, object>)totals).ToDictionary(kv => kv.Key, kv => Convert.ToInt64(kv.Value ?? 0)),
            };
            if (scoped)
            {
                // platform-wide user counts are meaningless for one admin's slice
                result.Totals.Remove("guests");
                result.Totals.Remove("eventAdmins");
            }

            result.Searches = Fill(from, days, await conn.QueryAsync<(DateTime Day, long N)>(
                $"SELECT DATE(s.started_at) AS Day, COUNT(*) AS N FROM searches s WHERE s.started_at >= @From {Where("s.event_id")} GROUP BY DATE(s.started_at)", p));
            result.Uploads = Fill(from, days, await conn.QueryAsync<(DateTime Day, long N)>(
                $"SELECT DATE(p.uploaded_at) AS Day, COUNT(*) AS N FROM photos p WHERE p.uploaded_at >= @From {Where("p.event_id")} GROUP BY DATE(p.uploaded_at)", p));
            result.Downloads = Fill(from, days, await conn.QueryAsync<(DateTime Day, long N)>(
                $"SELECT DATE(d.downloaded_at) AS Day, COUNT(*) AS N FROM downloads d WHERE d.downloaded_at >= @From {Where("d.event_id")} GROUP BY DATE(d.downloaded_at)", p));

            var status = await conn.QueryAsync<(string Status, long N)>(
                $"SELECT p.status, COUNT(*) FROM photos p WHERE 1=1 {Where("p.event_id")} GROUP BY p.status", p);
            result.PhotoStatus = new[] { "Pending", "Processing", "Completed", "Failed" }
                .ToDictionary(k => k, k => status.FirstOrDefault(x => x.Status == k).N);

            result.TopEvents = (await conn.QueryAsync<NamedCount>(@$"
                SELECT e.event_id AS Id, e.event_name AS Name, COUNT(s.search_id) AS Value
                FROM events e LEFT JOIN searches s ON s.event_id = e.event_id
                WHERE 1=1 {Where("e.event_id")}
                GROUP BY e.event_id, e.event_name
                HAVING Value > 0
                ORDER BY Value DESC LIMIT 10", p)).ToList();
            return result;
        }

        private static List<DailyPoint> Fill(DateTime from, int days, IEnumerable<(DateTime Day, long N)> rows)
        {
            var map = rows.ToDictionary(r => r.Day.Date, r => r.N);
            return Enumerable.Range(0, days)
                .Select(i => from.AddDays(i))
                .Select(d => new DailyPoint { Date = d.ToString("yyyy-MM-dd"), Value = map.TryGetValue(d, out var n) ? n : 0 })
                .ToList();
        }
    }
}
