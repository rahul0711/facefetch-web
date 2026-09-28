using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Helpers;
using genisis_Hub.Models;
using genisis_Hub.Models.Responses;

namespace genisis_Hub.Services
{
    public interface ISearchService
    {
        Task<SearchResponse> SearchAsync(ulong eventId, ulong? guestId, Visitor visitor, float[] queryEmbedding);
        Task<SearchResponse> RecordFailedSearchAsync(ulong eventId, ulong? guestId, Visitor visitor, string error);
        Task<List<VisitorResponse>> GetVisitorsAsync(ulong? eventId, string? search = null);
        Task<SearchResponse?> GetSearchResultsAsync(ulong searchId);
        Task<SearchResponse?> GetLatestForEventAsync(ulong userId, ulong eventId);
        Task<List<Search>> GetSearchesByEventAsync(ulong eventId);
        Task<List<Search>> GetSearchesByUserAsync(ulong userId);
        Task<List<MatchResponse>> GetMyPhotosAsync(ulong userId);
        Task<int> ClearHistoryAsync(ulong userId);
    }

    /// <summary>Who ran a search: typed in by the visitor before taking their selfie.</summary>
    public record Visitor(string Name, string Email);

    public class SearchService : ISearchService
    {
        private readonly DbContext _db;
        private readonly IFaceService _faces;
        private readonly SettingsService _settings;

        public SearchService(DbContext db, IFaceService faces, SettingsService settings)
        {
            _db = db; _faces = faces; _settings = settings;
        }

        public async Task<SearchResponse> SearchAsync(ulong eventId, ulong? guestId, Visitor visitor, float[] queryEmbedding)
        {
            // The threshold is a server setting -- never taken from the client.
            var threshold = await _settings.MatchThresholdAsync();
            using var conn = _db.CreateConnection();

            var searchId = await conn.QueryFirstAsync<ulong>(@"
                INSERT INTO searches (event_id, guest_id, visitor_name, visitor_email, search_status, face_detected, similarity_threshold)
                VALUES (@EventId, @GuestId, @VisitorName, @VisitorEmail, 'Processing', 1, @Threshold);
                SELECT LAST_INSERT_ID();",
                new { EventId = eventId, GuestId = guestId, VisitorName = visitor.Name, VisitorEmail = visitor.Email, Threshold = threshold });

            // Search ONLY this event's faces. Both sides are L2-normalised, so
            // cosine similarity == dot product.
            var faces = await _faces.GetFacesByEventAsync(eventId);
            var best = new Dictionary<ulong, (Face face, double score)>();
            foreach (var face in faces)
            {
                if (face.Embedding.Length != 512 * 4) continue;
                var score = CosineHelper.Similarity(queryEmbedding, CosineHelper.FromBlob(face.Embedding));
                if (score < (double)threshold) continue;
                if (!best.TryGetValue(face.PhotoId, out var cur) || score > cur.score)
                    best[face.PhotoId] = (face, score);
            }

            var ordered = best.OrderByDescending(kv => kv.Value.score).ToList();
            if (ordered.Count > 0)
            {
                await conn.ExecuteAsync(@"
                    INSERT IGNORE INTO search_matches (search_id, photo_id, similarity_score)
                    VALUES (@SearchId, @PhotoId, @Score)",
                    ordered.Select(kv => new { SearchId = searchId, PhotoId = kv.Key, Score = Math.Round(kv.Value.score, 6) }));
            }
            await conn.ExecuteAsync(@"
                UPDATE searches SET search_status='Completed', match_count=@Count, completed_at=NOW()
                WHERE search_id=@SearchId", new { Count = ordered.Count, SearchId = searchId });

            var response = await GetSearchResultsAsync(searchId) ?? new SearchResponse { SearchId = searchId };
            // Attach the face that matched in each photo (not stored in search_matches).
            var photos = response.Matches.ToDictionary(m => m.PhotoId);
            foreach (var (photoId, (face, _)) in ordered)
                if (photos.TryGetValue(photoId, out var m))
                    m.MatchedFace = FaceBoxResponse.From(face, m.Width, m.Height);
            return response;
        }

        public async Task<SearchResponse> RecordFailedSearchAsync(ulong eventId, ulong? guestId, Visitor visitor, string error)
        {
            var threshold = await _settings.MatchThresholdAsync();
            using var conn = _db.CreateConnection();
            var searchId = await conn.QueryFirstAsync<ulong>(@"
                INSERT INTO searches (event_id, guest_id, visitor_name, visitor_email, search_status, face_detected, similarity_threshold, completed_at, error_message)
                VALUES (@EventId, @GuestId, @VisitorName, @VisitorEmail, 'Failed', 0, @Threshold, NOW(), @Error);
                SELECT LAST_INSERT_ID();",
                new { EventId = eventId, GuestId = guestId, VisitorName = visitor.Name, VisitorEmail = visitor.Email, Threshold = threshold, Error = error });
            return await GetSearchResultsAsync(searchId) ?? new SearchResponse { SearchId = searchId };
        }

        public async Task<SearchResponse?> GetSearchResultsAsync(ulong searchId)
        {
            using var conn = _db.CreateConnection();
            var search = await conn.QueryFirstOrDefaultAsync<Search>(@"
                SELECT s.*, e.event_name AS EventName
                FROM searches s JOIN events e ON s.event_id = e.event_id
                WHERE s.search_id=@SearchId", new { SearchId = searchId });
            if (search == null) return null;

            var rows = await conn.QueryAsync<(ulong PhotoId, ulong EventId, decimal Score, string OriginalFileName,
                                              uint? Width, uint? Height, int FaceCount, DateTime UploadedAt)>(@"
                SELECT sm.photo_id, p.event_id, sm.similarity_score, p.original_file_name,
                       p.width, p.height, p.face_count, p.uploaded_at
                FROM search_matches sm JOIN photos p ON sm.photo_id = p.photo_id
                WHERE sm.search_id=@SearchId
                ORDER BY sm.similarity_score DESC", new { SearchId = searchId });

            return new SearchResponse
            {
                SearchId = search.SearchId,
                EventId = search.EventId,
                EventName = search.EventName,
                SearchStatus = search.SearchStatus,
                FaceDetected = search.FaceDetected,
                MatchCount = search.MatchCount,
                SimilarityThreshold = search.SimilarityThreshold,
                StartedAt = search.StartedAt,
                CompletedAt = search.CompletedAt,
                ErrorMessage = search.ErrorMessage,
                Matches = rows.Select(r => ToMatch(r.PhotoId, r.EventId, (double)r.Score, r.OriginalFileName, r.Width, r.Height, r.FaceCount, r.UploadedAt)).ToList(),
            };
        }

        public async Task<SearchResponse?> GetLatestForEventAsync(ulong userId, ulong eventId)
        {
            using var conn = _db.CreateConnection();
            var id = await conn.QueryFirstOrDefaultAsync<ulong?>(@"
                SELECT search_id FROM searches
                WHERE guest_id=@UserId AND event_id=@EventId AND search_status='Completed'
                ORDER BY started_at DESC, search_id DESC LIMIT 1", new { UserId = userId, EventId = eventId });
            return id is null ? null : await GetSearchResultsAsync(id.Value);
        }

        public async Task<List<Search>> GetSearchesByEventAsync(ulong eventId)
        {
            using var conn = _db.CreateConnection();
            return (await conn.QueryAsync<Search>(@"
                SELECT s.*, e.event_name AS EventName, COALESCE(s.visitor_name, u.full_name) AS GuestName
                FROM searches s
                JOIN events e ON s.event_id = e.event_id
                LEFT JOIN users u ON s.guest_id = u.user_id
                WHERE s.event_id=@EventId ORDER BY s.started_at DESC LIMIT 1000",
                new { EventId = eventId })).ToList();
        }

        public async Task<List<Search>> GetSearchesByUserAsync(ulong userId)
        {
            using var conn = _db.CreateConnection();
            return (await conn.QueryAsync<Search>(@"
                SELECT s.*, e.event_name AS EventName
                FROM searches s JOIN events e ON s.event_id = e.event_id
                WHERE s.guest_id=@UserId ORDER BY s.started_at DESC",
                new { UserId = userId })).ToList();
        }

        /// <summary>Every photo the user has been found in, across all their searches (best score per photo).</summary>
        public async Task<List<MatchResponse>> GetMyPhotosAsync(ulong userId)
        {
            using var conn = _db.CreateConnection();
            var rows = await conn.QueryAsync<(ulong PhotoId, ulong EventId, decimal Score, string OriginalFileName,
                                              uint? Width, uint? Height, int FaceCount, DateTime UploadedAt)>(@"
                SELECT p.photo_id, p.event_id, MAX(sm.similarity_score) AS score, p.original_file_name,
                       p.width, p.height, p.face_count, p.uploaded_at
                FROM search_matches sm
                JOIN searches s ON s.search_id = sm.search_id
                JOIN photos p ON p.photo_id = sm.photo_id
                WHERE s.guest_id = @UserId
                GROUP BY p.photo_id, p.event_id, p.original_file_name, p.width, p.height, p.face_count, p.uploaded_at
                ORDER BY score DESC", new { UserId = userId });
            return rows.Select(r => ToMatch(r.PhotoId, r.EventId, (double)r.Score, r.OriginalFileName, r.Width, r.Height, r.FaceCount, r.UploadedAt)).ToList();
        }

        /// <summary>
        /// Everyone who searched (one row per email), newest first; optionally only
        /// in one event, and filtered by name/email text.
        /// </summary>
        public async Task<List<VisitorResponse>> GetVisitorsAsync(ulong? eventId, string? search = null)
        {
            using var conn = _db.CreateConnection();
            return (await conn.QueryAsync<VisitorResponse>(@"
                SELECT MAX(s.visitor_name)          AS Name,
                       LOWER(s.visitor_email)       AS Email,
                       COUNT(*)                     AS Searches,
                       CAST(COALESCE(MAX(s.match_count), 0) AS SIGNED) AS PhotosFound,
                       GROUP_CONCAT(DISTINCT e.event_name ORDER BY e.event_name SEPARATOR ', ') AS Events,
                       MIN(s.started_at)            AS FirstSeen,
                       MAX(s.started_at)            AS LastSeen
                FROM searches s JOIN events e ON e.event_id = s.event_id
                WHERE s.visitor_email IS NOT NULL
                  AND (@EventId IS NULL OR s.event_id = @EventId)
                  AND (@Search IS NULL OR s.visitor_name LIKE @Like OR s.visitor_email LIKE @Like)
                GROUP BY LOWER(s.visitor_email)
                ORDER BY LastSeen DESC
                LIMIT 5000",
                new { EventId = eventId, Search = string.IsNullOrWhiteSpace(search) ? null : search, Like = $"%{search}%" })).ToList();
        }

        /// <summary>Deletes the user's searches (their matches cascade).</summary>
        public async Task<int> ClearHistoryAsync(ulong userId)
        {
            using var conn = _db.CreateConnection();
            return await conn.ExecuteAsync("DELETE FROM searches WHERE guest_id=@UserId", new { UserId = userId });
        }

        private static MatchResponse ToMatch(ulong photoId, ulong eventId, double score, string name, uint? w, uint? h, int faces, DateTime uploadedAt) => new()
        {
            PhotoId = photoId,
            EventId = eventId,
            SimilarityScore = Math.Round(score, 4),
            ImageUrl = Urls.PhotoImage(photoId),
            ThumbnailUrl = Urls.PhotoThumbnail(photoId),
            DownloadUrl = Urls.PhotoDownload(photoId),
            OriginalFileName = name,
            Width = w,
            Height = h,
            FaceCount = faces,
            UploadedAt = uploadedAt,
        };
    }
}
