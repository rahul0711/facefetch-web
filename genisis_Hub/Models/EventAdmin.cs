namespace genisis_Hub.Models
{
    public class EventAdmin
    {
        public ulong    EventAdminId { get; set; }
        public ulong    EventId      { get; set; }
        public ulong    UserId       { get; set; }
        public bool     CanView      { get; set; } = true;
        public bool     CanUpload    { get; set; } = true;
        public bool     CanDelete    { get; set; } = false;
        public bool     CanManage    { get; set; } = false;
        public ulong    AssignedBy   { get; set; }
        public DateTime AssignedAt   { get; set; }

        // Joined
        public string?  UserFullName  { get; set; }
        public string?  UserEmail     { get; set; }
        public string?  EventName     { get; set; }
        public string?  AssignedByName { get; set; }
    }
}
