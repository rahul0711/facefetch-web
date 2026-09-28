namespace genisis_Hub.Models
{
    public class Event
    {
        public ulong    EventId     { get; set; }
        public string   EventName   { get; set; } = string.Empty;
        public string   EventCode   { get; set; } = string.Empty;
        public string?  Description { get; set; }
        public DateTime? EventDate  { get; set; }
        public string?  Location    { get; set; }
        public string?  CoverImage  { get; set; }
        public string   Status      { get; set; } = "Draft";
        public ulong    CreatedBy   { get; set; }
        public DateTime CreatedAt   { get; set; }
        public DateTime UpdatedAt   { get; set; }

        // Joined from users table
        public string?  CreatedByName { get; set; }
        public int      PhotoCount    { get; set; }
    }
}
