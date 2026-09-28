namespace genisis_Hub.Models.Responses
{
    /// <summary>API URLs for stored images. File paths never leave the server.</summary>
    public static class Urls
    {
        public static string PhotoImage(ulong photoId)     => $"/api/photos/{photoId}/image";
        public static string PhotoThumbnail(ulong photoId) => $"/api/photos/{photoId}/thumbnail";
        public static string PhotoDownload(ulong photoId)  => $"/api/photos/{photoId}/download";
        public static string? EventCover(ulong eventId, string? coverPath) => string.IsNullOrEmpty(coverPath) ? null : $"/api/events/{eventId}/cover";
    }

    public class LoginResponse
    {
        public string  Token     { get; set; } = string.Empty;
        public string  Role      { get; set; } = string.Empty;
        public ulong   UserId    { get; set; }
        public string  FullName  { get; set; } = string.Empty;
        public string  Email     { get; set; } = string.Empty;
        public string? ProfileImage { get; set; }
        public DateTime ExpiresAt { get; set; }
    }

    public class UserResponse
    {
        public ulong    UserId        { get; set; }
        public string   FullName      { get; set; } = string.Empty;
        public string   Email         { get; set; } = string.Empty;
        public string?  Phone         { get; set; }
        public string?  ProfileImage  { get; set; }
        public uint     RoleId        { get; set; }
        public string   RoleName      { get; set; } = string.Empty;
        public bool     IsActive      { get; set; }
        public bool     EmailVerified { get; set; }
        public DateTime? LastLoginAt  { get; set; }
        public DateTime CreatedAt     { get; set; }
    }

    public class AssignedEventBrief
    {
        public ulong  EventId   { get; set; }
        public string EventName { get; set; } = string.Empty;
        public string Status    { get; set; } = string.Empty;
        public bool   CanView   { get; set; }
        public bool   CanUpload { get; set; }
        public bool   CanDelete { get; set; }
        public bool   CanManage { get; set; }
    }

    public class EventAdminUserResponse : UserResponse
    {
        public List<AssignedEventBrief> AssignedEvents { get; set; } = new();
    }

    public class EventResponse
    {
        public ulong    EventId       { get; set; }
        public string   EventName     { get; set; } = string.Empty;
        public string   EventCode     { get; set; } = string.Empty;
        public string?  Description   { get; set; }
        public DateTime? EventDate    { get; set; }
        public string?  Location      { get; set; }
        public string?  CoverUrl      { get; set; }
        public string   Status        { get; set; } = string.Empty;
        public ulong    CreatedBy     { get; set; }
        public string?  CreatedByName { get; set; }
        public DateTime CreatedAt     { get; set; }
        public DateTime UpdatedAt     { get; set; }
        public int      PhotoCount    { get; set; }
        /// <summary>Filled for event admins: their own permissions on this event.</summary>
        public AssignedEventBrief? MyPermissions { get; set; }

        public static EventResponse From(Event e) => new()
        {
            EventId = e.EventId, EventName = e.EventName, EventCode = e.EventCode, Description = e.Description,
            EventDate = e.EventDate, Location = e.Location, CoverUrl = Urls.EventCover(e.EventId, e.CoverImage),
            Status = e.Status, CreatedBy = e.CreatedBy, CreatedByName = e.CreatedByName,
            CreatedAt = e.CreatedAt, UpdatedAt = e.UpdatedAt, PhotoCount = e.PhotoCount,
        };
    }

    public class FaceBoxResponse
    {
        public ulong   FaceId     { get; set; }
        public int     FaceIndex  { get; set; }
        /// <summary>Pixels in the stored (compressed) image.</summary>
        public int     X { get; set; }
        public int     Y { get; set; }
        public uint    Width  { get; set; }
        public uint    Height { get; set; }
        /// <summary>Same box as fractions [x1, y1, x2, y2] -- handy for CSS overlays.</summary>
        public double[] Box { get; set; } = Array.Empty<double>();
        public decimal? Confidence { get; set; }

        public static FaceBoxResponse From(Face f, uint? imgW, uint? imgH)
        {
            double w = imgW is > 0 ? imgW.Value : 1, h = imgH is > 0 ? imgH.Value : 1;
            return new()
            {
                FaceId = f.FaceId, FaceIndex = f.FaceIndex, X = f.X, Y = f.Y, Width = f.Width, Height = f.Height,
                Confidence = f.DetectionConfidence,
                Box = new[] { Math.Round(f.X / w, 4), Math.Round(f.Y / h, 4), Math.Round((f.X + f.Width) / w, 4), Math.Round((f.Y + f.Height) / h, 4) },
            };
        }
    }

    public class PhotoResponse
    {
        public ulong    PhotoId          { get; set; }
        public ulong    EventId          { get; set; }
        public string?  EventName        { get; set; }
        public string   OriginalFileName { get; set; } = string.Empty;
        public string   ImageUrl         { get; set; } = string.Empty;
        public string   ThumbnailUrl     { get; set; } = string.Empty;
        public string   DownloadUrl      { get; set; } = string.Empty;
        public ulong?   FileSize         { get; set; }
        public string?  MimeType         { get; set; }
        public uint?    Width            { get; set; }
        public uint?    Height           { get; set; }
        public int      FaceCount        { get; set; }
        public string   Status           { get; set; } = string.Empty;
        public ulong    UploadedBy       { get; set; }
        public string?  UploadedByName   { get; set; }
        public DateTime UploadedAt       { get; set; }
        public DateTime? ProcessedAt     { get; set; }
        public string?  ErrorMessage     { get; set; }
        public List<FaceBoxResponse>? Faces { get; set; }

        public static PhotoResponse From(Photo p) => new()
        {
            PhotoId = p.PhotoId, EventId = p.EventId, EventName = p.EventName, OriginalFileName = p.OriginalFileName,
            ImageUrl = Urls.PhotoImage(p.PhotoId), ThumbnailUrl = Urls.PhotoThumbnail(p.PhotoId), DownloadUrl = Urls.PhotoDownload(p.PhotoId),
            FileSize = p.FileSize, MimeType = p.MimeType, Width = p.Width, Height = p.Height, FaceCount = p.FaceCount,
            Status = p.Status, UploadedBy = p.UploadedBy, UploadedByName = p.UploadedByName, UploadedAt = p.UploadedAt,
            ProcessedAt = p.ProcessedAt, ErrorMessage = p.ErrorMessage,
        };
    }

    public class PagedResponse<T>
    {
        public List<T> Items    { get; set; } = new();
        public int     Page     { get; set; }
        public int     PageSize { get; set; }
        public long    Total    { get; set; }
    }

    public class UploadResultItem
    {
        public string  FileName  { get; set; } = string.Empty;
        public ulong?  PhotoId   { get; set; }
        public string  Status    { get; set; } = string.Empty; // Completed | Failed | Rejected
        public int     FaceCount { get; set; }
        public string? Error     { get; set; }
        public string? ThumbnailUrl { get; set; }
    }

    public class SearchResponse
    {
        public ulong    SearchId            { get; set; }
        public ulong    EventId             { get; set; }
        public string?  EventName           { get; set; }
        public string   SearchStatus        { get; set; } = string.Empty;
        public bool     FaceDetected        { get; set; }
        public uint     MatchCount          { get; set; }
        public decimal  SimilarityThreshold { get; set; }
        public DateTime StartedAt           { get; set; }
        public DateTime? CompletedAt        { get; set; }
        public string?  ErrorMessage        { get; set; }
        /// <summary>SearchPass key: lets this visitor (even without an account) open the matched photos.</summary>
        public string?  AccessKey           { get; set; }
        public List<MatchResponse> Matches  { get; set; } = new();

        /// <summary>Sets AccessKey and appends ?key= to every photo URL.</summary>
        public SearchResponse WithAccessKey(string key)
        {
            AccessKey = key;
            var q = "?key=" + Uri.EscapeDataString(key);
            foreach (var m in Matches)
            {
                m.ImageUrl += q;
                m.ThumbnailUrl += q;
                m.DownloadUrl += q;
            }
            return this;
        }
    }

    /// <summary>One person (by email) who searched, with their totals.</summary>
    public class VisitorResponse
    {
        public string   Name        { get; set; } = string.Empty;
        public string   Email       { get; set; } = string.Empty;
        public int      Searches    { get; set; }
        public int      PhotosFound { get; set; }
        public string?  Events      { get; set; }
        public DateTime FirstSeen   { get; set; }
        public DateTime LastSeen    { get; set; }
    }

    public class MatchResponse
    {
        public ulong   PhotoId          { get; set; }
        public ulong   EventId          { get; set; }
        public double  SimilarityScore  { get; set; }
        public string  ImageUrl         { get; set; } = string.Empty;
        public string  ThumbnailUrl     { get; set; } = string.Empty;
        public string  DownloadUrl      { get; set; } = string.Empty;
        public string? OriginalFileName { get; set; }
        public uint?   Width            { get; set; }
        public uint?   Height           { get; set; }
        public int     FaceCount        { get; set; }
        public DateTime UploadedAt      { get; set; }
        /// <summary>The face that matched. Only present in the response to the search itself
        /// (search_matches doesn't store which face matched).</summary>
        public FaceBoxResponse? MatchedFace { get; set; }
    }

    public class AdminDashboardResponse
    {
        public int TotalUsers    { get; set; }
        public int TotalEvents   { get; set; }
        public int TotalPhotos   { get; set; }
        public int TotalSearches { get; set; }
        public int TotalFaces    { get; set; }
        public int ActiveEvents  { get; set; }
        public List<RecentActivityResponse> RecentActivity { get; set; } = new();
    }

    public class RecentActivityResponse
    {
        public ulong    LogId       { get; set; }
        public string?  UserName    { get; set; }
        public string?  EventName   { get; set; }
        public string   Action      { get; set; } = string.Empty;
        public string?  Description { get; set; }
        public DateTime CreatedAt   { get; set; }
    }

    // ── statistics / analytics ──────────────────────────────────────────────
    public class EventStatsResponse
    {
        public ulong EventId          { get; set; }
        public long  Photos           { get; set; }
        public long  PhotosCompleted  { get; set; }
        public long  PhotosPending    { get; set; }
        public long  PhotosProcessing { get; set; }
        public long  PhotosFailed     { get; set; }
        public long  Faces            { get; set; }
        public long  Searches         { get; set; }
        public long  SuccessfulSearches { get; set; }
        public long  UniqueVisitors   { get; set; }
        public long  Downloads        { get; set; }
        public long  StorageBytes     { get; set; }
    }

    public class DailyPoint
    {
        public string Date  { get; set; } = string.Empty; // yyyy-MM-dd
        public long   Value { get; set; }
    }

    public class NamedCount
    {
        public ulong  Id    { get; set; }
        public string Name  { get; set; } = string.Empty;
        public long   Value { get; set; }
    }

    public class AnalyticsResponse
    {
        public int  Days { get; set; }
        public Dictionary<string, long> Totals { get; set; } = new();
        public List<DailyPoint> Searches  { get; set; } = new();
        public List<DailyPoint> Uploads   { get; set; } = new();
        public List<DailyPoint> Downloads { get; set; } = new();
        public Dictionary<string, long> PhotoStatus { get; set; } = new();
        public List<NamedCount> TopEvents { get; set; } = new();
    }
}
