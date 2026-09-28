using System.Security.Cryptography;
using System.Text;

namespace genisis_Hub.Helpers
{
    /// <summary>
    /// A signed, expiring key that lets whoever ran a search -- including a
    /// visitor with no account -- see the photos that search matched, and
    /// nothing else. Format: "{searchId}.{expiresUnix}.{hmac}", passed as ?key=.
    /// </summary>
    public static class SearchPass
    {
        public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

        public static string Create(IConfiguration config, ulong searchId)
        {
            var exp = DateTimeOffset.UtcNow.Add(Lifetime).ToUnixTimeSeconds();
            return $"{searchId}.{exp}.{Sign(config, searchId, exp)}";
        }

        /// <summary>The search id the key grants, or null if it is malformed, forged or expired.</summary>
        public static ulong? Validate(IConfiguration config, string? key)
        {
            var parts = key?.Split('.');
            if (parts is not { Length: 3 }
                || !ulong.TryParse(parts[0], out var searchId)
                || !long.TryParse(parts[1], out var exp)
                || exp < DateTimeOffset.UtcNow.ToUnixTimeSeconds())
                return null;
            var expected = Encoding.ASCII.GetBytes(Sign(config, searchId, exp));
            return CryptographicOperations.FixedTimeEquals(expected, Encoding.ASCII.GetBytes(parts[2])) ? searchId : null;
        }

        private static string Sign(IConfiguration config, ulong searchId, long exp)
        {
            var secret = Encoding.UTF8.GetBytes("search-pass:" + config["Jwt:SecretKey"]);
            var mac = HMACSHA256.HashData(secret, Encoding.ASCII.GetBytes($"{searchId}.{exp}"));
            return Convert.ToBase64String(mac).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        }
    }
}
