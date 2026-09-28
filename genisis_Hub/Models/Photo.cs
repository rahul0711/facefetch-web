namespace genisis_Hub.Models
{
    public class Photo
    {
        public ulong    PhotoId          { get; set; }
        public ulong    EventId          { get; set; }
        public string   OriginalFileName { get; set; } = string.Empty;
        public string   StoredFileName   { get; set; } = string.Empty;
        public string   FilePath         { get; set; } = string.Empty;
        public string?  ThumbnailPath    { get; set; }
        public ulong?   FileSize         { get; set; }
        public string?  MimeType         { get; set; }
        public uint?    Width            { get; set; }
        public uint?    Height           { get; set; }
        public int      FaceCount        { get; set; } = 0;
        public string   Status           { get; set; } = "Pending";
        public ulong    UploadedBy       { get; set; }
        public DateTime UploadedAt       { get; set; }
        public DateTime? ProcessedAt     { get; set; }
        public string?  ErrorMessage     { get; set; }

        // Joined
        public string?  UploadedByName   { get; set; }
        public string?  EventName        { get; set; }
    }
}
