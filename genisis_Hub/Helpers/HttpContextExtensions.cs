using System.Security.Claims;

namespace genisis_Hub.Helpers
{
    public static class Roles
    {
        public const string SuperAdmin = "SuperAdmin";
        public const string EventAdmin = "EventAdmin";
        public const string Guest      = "Guest";
    }

    public static class HttpContextExtensions
    {
        public static string? ClientIp(this HttpContext ctx) => ctx.Connection.RemoteIpAddress?.ToString();

        public static string? ClientAgent(this HttpContext ctx)
        {
            var ua = ctx.Request.Headers.UserAgent.ToString();
            return ua.Length > 500 ? ua[..500] : ua;
        }

        public static bool IsSuperAdmin(this ClaimsPrincipal user) => user.IsInRole(Roles.SuperAdmin);
    }
}
