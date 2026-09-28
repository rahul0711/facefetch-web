namespace genisis_Hub.Models
{
    public class Download
    {
        public ulong    DownloadId    { get; set; }
        public ulong?   UserId        { get; set; }
        public ulong    EventId       { get; set; }
        public ulong    PhotoId       { get; set; }
        public string   DownloadType  { get; set; } = "Single";
        public DateTime DownloadedAt  { get; set; }
        public string?  IpAddress     { get; set; }
        public string?  UserAgent     { get; set; }
    }
}
