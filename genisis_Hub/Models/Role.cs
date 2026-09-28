namespace genisis_Hub.Models
{
    public class Role
    {
        public uint     RoleId      { get; set; }
        public string   RoleName    { get; set; } = string.Empty;
        public string?  Description { get; set; }
        public DateTime CreatedAt   { get; set; }
    }
}
