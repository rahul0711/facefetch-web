using System.ComponentModel.DataAnnotations;

namespace genisis_Hub.Models.Requests
{
    public class LoginRequest
    {
        [Required, EmailAddress]
        public string Email    { get; set; } = string.Empty;
        [Required, MinLength(6)]
        public string Password { get; set; } = string.Empty;
    }

    public class SignupRequest
    {
        [Required, MaxLength(150)]
        public string FullName { get; set; } = string.Empty;
        [Required, EmailAddress, MaxLength(255)]
        public string Email    { get; set; } = string.Empty;
        [Required, MinLength(6)]
        public string Password { get; set; } = string.Empty;
        [MaxLength(30)]
        public string? Phone   { get; set; }
    }

    public class UpdateProfileRequest
    {
        [Required, MaxLength(150)]
        public string FullName { get; set; } = string.Empty;
        [MaxLength(30)]
        public string? Phone   { get; set; }
    }

    public class CreateUserRequest
    {
        [Required, MaxLength(150)]
        public string FullName { get; set; } = string.Empty;
        [Required, EmailAddress, MaxLength(255)]
        public string Email    { get; set; } = string.Empty;
        [Required, MinLength(6)]
        public string Password { get; set; } = string.Empty;
        [MaxLength(30)]
        public string? Phone   { get; set; }
        /// <summary>SuperAdmin | EventAdmin | Guest (default EventAdmin).</summary>
        public string RoleName { get; set; } = "EventAdmin";
    }

    public class CreateEventRequest
    {
        [Required, MaxLength(255)]
        public string  EventName   { get; set; } = string.Empty;
        [Required, MaxLength(100), RegularExpression("^[a-zA-Z0-9-]+$", ErrorMessage = "Event code: letters, numbers and dashes only")]
        public string  EventCode   { get; set; } = string.Empty;
        public string? Description { get; set; }
        /// <summary>yyyy-MM-dd</summary>
        public string? EventDate   { get; set; }
        [MaxLength(500)]
        public string? Location    { get; set; }
        [RegularExpression("^(Draft|Active|Completed|Archived)$")]
        public string  Status      { get; set; } = "Draft";
    }

    public class UpdateEventRequest
    {
        [Required, MaxLength(255)]
        public string  EventName   { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? EventDate   { get; set; }
        [MaxLength(500)]
        public string? Location    { get; set; }
        [RegularExpression("^(Draft|Active|Completed|Archived)$")]
        public string  Status      { get; set; } = "Draft";
    }

    public class UpdateStatusRequest
    {
        [Required, RegularExpression("^(Draft|Active|Completed|Archived)$")]
        public string Status { get; set; } = string.Empty;
    }

    public class AssignAdminRequest
    {
        [Required]
        public ulong UserId    { get; set; }
        public bool  CanView   { get; set; } = true;
        public bool  CanUpload { get; set; } = true;
        public bool  CanDelete { get; set; } = false;
        public bool  CanManage { get; set; } = false;
    }

    public class UpdatePermissionsRequest
    {
        public bool CanView   { get; set; }
        public bool CanUpload { get; set; }
        public bool CanDelete { get; set; }
        public bool CanManage { get; set; }
    }

    public class UpdateSettingRequest
    {
        [Required]
        public string SettingValue { get; set; } = string.Empty;
    }

    public class UpdateUserRoleRequest
    {
        [Required]
        public uint RoleId { get; set; }
    }

    public class ChangePasswordRequest
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;
        [Required, MinLength(6)]
        public string NewPassword     { get; set; } = string.Empty;
    }

    public class PhotoIdsRequest
    {
        [Required, MinLength(1), MaxLength(500)]
        public List<ulong> PhotoIds { get; set; } = new();
    }
}
