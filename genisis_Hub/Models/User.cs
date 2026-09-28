namespace genisis_Hub.Models
{
    public class User
    {
        public ulong     UserId         { get; set; }
        public string    FullName       { get; set; } = string.Empty;
        public string    Email          { get; set; } = string.Empty;
        public string    PasswordHash   { get; set; } = string.Empty;
        public string?   Phone          { get; set; }
        public string?   ProfileImage   { get; set; }
        public uint      RoleId         { get; set; }
        public bool      IsActive       { get; set; } = true;
        public bool      EmailVerified  { get; set; } = false;
        public DateTime? LastLoginAt    { get; set; }
        public DateTime  CreatedAt      { get; set; }
        public DateTime  UpdatedAt      { get; set; }

        // Joined from roles table (not a FK column)
        public string?   RoleName       { get; set; }
    }
}
