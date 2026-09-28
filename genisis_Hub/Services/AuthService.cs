using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Helpers;
using genisis_Hub.Models;
using genisis_Hub.Models.Requests;
using genisis_Hub.Models.Responses;

namespace genisis_Hub.Services
{
    public interface IAuthService
    {
        Task<LoginResponse?> LoginAsync(LoginRequest request, IConfiguration config);
        Task<User?> GetUserByIdAsync(ulong userId);
        Task<bool> ChangePasswordAsync(ulong userId, ChangePasswordRequest request);
        Task<bool> UpdateProfileImageAsync(ulong userId, string imagePath);
        Task<bool> UpdateProfileAsync(ulong userId, string fullName, string? phone);
        Task<User?> CreateUserAsync(string fullName, string email, string password, string? phone, string roleName);
        Task EnsureSuperAdminAsync(IConfiguration config, ILogger logger);
    }

    public class AuthService : IAuthService
    {
        private readonly DbContext _db;
        public AuthService(DbContext db) => _db = db;

        public async Task<LoginResponse?> LoginAsync(LoginRequest request, IConfiguration config)
        {
            using var conn = _db.CreateConnection();
            var sql = @"SELECT u.*, r.role_name AS RoleName
                        FROM users u
                        JOIN roles r ON u.role_id = r.role_id
                        WHERE u.email = @Email AND u.is_active = 1";
            var user = await conn.QueryFirstOrDefaultAsync<User>(sql, new { Email = request.Email.Trim() });
            if (user == null || string.IsNullOrEmpty(user.PasswordHash)) return null;
            if (!PasswordHelper.Verify(request.Password, user.PasswordHash)) return null;

            // Update last login
            await conn.ExecuteAsync("UPDATE users SET last_login_at = NOW() WHERE user_id = @UserId",
                new { UserId = user.UserId });

            var expiryHours = double.Parse(config["Jwt:ExpiryHours"] ?? "24");
            return new LoginResponse
            {
                Token        = JwtHelper.GenerateToken(config, user.UserId, user.Email, user.RoleName!, user.FullName),
                Role         = user.RoleName!,
                UserId       = user.UserId,
                FullName     = user.FullName,
                Email        = user.Email,
                ProfileImage = user.ProfileImage,
                ExpiresAt    = DateTime.UtcNow.AddHours(expiryHours)
            };
        }

        public async Task<User?> GetUserByIdAsync(ulong userId)
        {
            using var conn = _db.CreateConnection();
            var sql = @"SELECT u.*, r.role_name AS RoleName
                        FROM users u
                        JOIN roles r ON u.role_id = r.role_id
                        WHERE u.user_id = @UserId";
            return await conn.QueryFirstOrDefaultAsync<User>(sql, new { UserId = userId });
        }

        public async Task<bool> ChangePasswordAsync(ulong userId, ChangePasswordRequest request)
        {
            using var conn = _db.CreateConnection();
            var user = await conn.QueryFirstOrDefaultAsync<User>(
                "SELECT * FROM users WHERE user_id = @UserId", new { UserId = userId });
            if (user == null || !PasswordHelper.Verify(request.CurrentPassword, user.PasswordHash))
                return false;
            await conn.ExecuteAsync(
                "UPDATE users SET password_hash = @Hash WHERE user_id = @UserId",
                new { Hash = PasswordHelper.Hash(request.NewPassword), UserId = userId });
            return true;
        }

        public async Task<bool> UpdateProfileAsync(ulong userId, string fullName, string? phone)
        {
            using var conn = _db.CreateConnection();
            return await conn.ExecuteAsync("UPDATE users SET full_name=@FullName, phone=@Phone WHERE user_id=@UserId",
                new { FullName = fullName.Trim(), Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim(), UserId = userId }) > 0;
        }

        /// <summary>Admin-created account with any role. Null if the email exists or the role is unknown.</summary>
        public async Task<User?> CreateUserAsync(string fullName, string email, string password, string? phone, string roleName)
        {
            using var conn = _db.CreateConnection();
            if (await conn.ExecuteScalarAsync<long>("SELECT COUNT(*) FROM users WHERE email=@Email", new { Email = email.Trim() }) > 0)
                return null;
            var roleId = await conn.QueryFirstOrDefaultAsync<uint?>("SELECT role_id FROM roles WHERE role_name=@RoleName", new { RoleName = roleName });
            if (roleId is null) return null;
            var id = await conn.QueryFirstAsync<ulong>(@"
                INSERT INTO users (full_name, email, password_hash, phone, role_id)
                VALUES (@FullName, @Email, @PasswordHash, @Phone, @RoleId);
                SELECT LAST_INSERT_ID();",
                new { FullName = fullName.Trim(), Email = email.Trim(), PasswordHash = PasswordHelper.Hash(password), Phone = phone, RoleId = roleId });
            return await GetUserByIdAsync(id);
        }

        /// <summary>
        /// First-run bootstrap: if there is no SuperAdmin yet and
        /// Bootstrap:SuperAdminEmail / Bootstrap:SuperAdminPassword are configured
        /// (e.g. as environment variables), create that account. Does nothing afterwards.
        /// </summary>
        public async Task EnsureSuperAdminAsync(IConfiguration config, ILogger logger)
        {
            var email = config["Bootstrap:SuperAdminEmail"];
            var password = config["Bootstrap:SuperAdminPassword"];
            if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password)) return;
            using var conn = _db.CreateConnection();
            var existing = await conn.ExecuteScalarAsync<long>(@"
                SELECT COUNT(*) FROM users u JOIN roles r ON r.role_id=u.role_id WHERE r.role_name='SuperAdmin'");
            if (existing > 0) return;
            var user = await CreateUserAsync(config["Bootstrap:SuperAdminName"] ?? "Super Admin", email, password, null, "SuperAdmin");
            logger.LogWarning(user is null
                ? "Bootstrap: could not create SuperAdmin {Email} (email already used?)"
                : "Bootstrap: created first SuperAdmin {Email}. Remove the Bootstrap settings now.", email);
        }

        public async Task<bool> UpdateProfileImageAsync(ulong userId, string imagePath)
        {
            using var conn = _db.CreateConnection();
            await conn.ExecuteAsync(
                "UPDATE users SET profile_image = @ImagePath WHERE user_id = @UserId",
                new { ImagePath = imagePath, UserId = userId });
            return true;
        }
    }
}
