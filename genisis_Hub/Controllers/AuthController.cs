using genisis_Hub.Helpers;
using genisis_Hub.Models.Requests;
using genisis_Hub.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SixLabors.ImageSharp;

namespace genisis_Hub.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _auth;
        private readonly IConfiguration _config;
        private readonly ActivityLogService _log;
        private readonly ImageStorage _images;
        private readonly IWebHostEnvironment _env;

        public AuthController(IAuthService auth, IConfiguration config, ActivityLogService log, ImageStorage images, IWebHostEnvironment env)
        {
            _auth = auth; _config = config; _log = log; _images = images; _env = env;
        }

        // POST api/auth/login
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid input"));
            var result = await _auth.LoginAsync(request, _config);
            if (result == null) return Unauthorized(ApiResponse<object>.Fail("Invalid email or password"));

            await _log.LogAsync(result.UserId, null, "LOGIN", $"{result.Email} logged in", HttpContext.ClientIp(), HttpContext.ClientAgent());
            return Ok(ApiResponse<object>.Ok(result, "Login successful"));
        }

        // POST api/auth/signup  -- always creates a Guest
        [HttpPost("signup")]
        public async Task<IActionResult> Signup([FromBody] SignupRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid input"));
            var user = await _auth.SignupAsync(request);
            if (user == null) return Conflict(ApiResponse<object>.Fail("Email already registered"));

            await _log.LogAsync(user.UserId, null, "SIGNUP", $"{user.Email} signed up");
            return Ok(ApiResponse<object>.Ok(new { user.UserId, user.FullName, user.Email, user.RoleName }, "Account created"));
        }

        // GET api/auth/me
        [HttpGet("me")]
        [Authorize]
        public async Task<IActionResult> Me()
        {
            var user = await _auth.GetUserByIdAsync(JwtHelper.GetUserId(User));
            if (user == null) return NotFound(ApiResponse<object>.Fail("User not found"));
            return Ok(ApiResponse<object>.Ok(new
            {
                user.UserId, user.FullName, user.Email, user.Phone,
                user.ProfileImage, user.RoleName, user.IsActive, user.EmailVerified,
                user.LastLoginAt, user.CreatedAt
            }));
        }

        // PUT api/auth/me  -- update own name / phone
        [HttpPut("me")]
        [Authorize]
        public async Task<IActionResult> UpdateMe([FromBody] UpdateProfileRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid input"));
            await _auth.UpdateProfileAsync(JwtHelper.GetUserId(User), request.FullName, request.Phone);
            return await Me();
        }

        // POST api/auth/change-password
        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
        {
            if (!ModelState.IsValid) return BadRequest(ApiResponse<object>.Fail("Invalid input"));
            var ok = await _auth.ChangePasswordAsync(JwtHelper.GetUserId(User), request);
            if (!ok) return BadRequest(ApiResponse<object>.Fail("Current password is incorrect"));
            return Ok(ApiResponse.Ok("Password changed successfully"));
        }

        // POST api/auth/upload-avatar  (multipart "file") -- stored compressed, 256px
        [HttpPost("upload-avatar")]
        [Authorize]
        [RequestSizeLimit(15 * 1024 * 1024)]
        public async Task<IActionResult> UploadAvatar(IFormFile file)
        {
            if (file == null || file.Length == 0) return BadRequest(ApiResponse<object>.Fail("No file provided"));
            var userId = JwtHelper.GetUserId(User);
            ProcessedImage img;
            try
            {
                await using var s = file.OpenReadStream();
                img = await _images.ProcessAsync(s, maxSide: 256);
            }
            catch (Exception ex) when (ex is UnknownImageFormatException or InvalidImageContentException or NotSupportedException)
            {
                return BadRequest(ApiResponse<object>.Fail("Not a readable image"));
            }
            // Avatars are public (wwwroot), unlike event photos.
            var dir = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), "uploads", "avatars");
            Directory.CreateDirectory(dir);
            var fileName = $"{userId}_{Guid.NewGuid():N}.jpg";
            await System.IO.File.WriteAllBytesAsync(Path.Combine(dir, fileName), img.Compressed);
            var relativePath = $"/uploads/avatars/{fileName}";
            await _auth.UpdateProfileImageAsync(userId, relativePath);
            return Ok(ApiResponse<object>.Ok(new { ProfileImage = relativePath }));
        }
    }
}
