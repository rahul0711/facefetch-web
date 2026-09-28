namespace genisis_Hub.Models
{
    public class SystemSetting
    {
        public uint     SettingId    { get; set; }
        public string   SettingKey   { get; set; } = string.Empty;
        public string   SettingValue { get; set; } = string.Empty;
        public string?  Description  { get; set; }
        public ulong?   UpdatedBy    { get; set; }
        public DateTime UpdatedAt    { get; set; }

        // Joined
        public string?  UpdatedByName { get; set; }
    }
}
