namespace genisis_Hub.Models
{
    public class ActivityLog
    {
        public ulong    LogId       { get; set; }
        public ulong?   UserId      { get; set; }
        public ulong?   EventId     { get; set; }
        public string   Action      { get; set; } = string.Empty;
        public string?  Description { get; set; }
        public string?  IpAddress   { get; set; }
        public string?  UserAgent   { get; set; }
        public DateTime CreatedAt   { get; set; }

        // Joined
        public string?  UserFullName { get; set; }
        public string?  EventName    { get; set; }
    }
}
