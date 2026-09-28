using System.Security.Claims;
using Dapper;
using genisis_Hub.Data;
using genisis_Hub.Helpers;
using genisis_Hub.Models;

namespace genisis_Hub.Services
{
    /// <summary>
    /// Every "can this user do X to this event/photo" rule in one place.
    ///   SuperAdmin  -> everything
    ///   EventAdmin  -> only events in event_admins, limited by its can_* flags
    ///   Guest       -> only Active/Completed events, and only photos their
    ///                  own searches matched
    /// </summary>
    public class AccessService
    {
        public static readonly string[] GuestVisibleStatuses = { "Active", "Completed" };
        private readonly DbContext _db;
        public AccessService(DbContext db) => _db = db;

        /// <summary>Event-level permissions. SuperAdmin gets a full set; null = no access.</summary>
        public async Task<EventAdmin?> PermissionsAsync(ulong eventId, ClaimsPrincipal user)
        {
            if (user.IsSuperAdmin())
                return new EventAdmin { EventId = eventId, CanView = true, CanUpload = true, CanDelete = true, CanManage = true };
            if (!user.IsInRole(Roles.EventAdmin)) return null;
            using var conn = _db.CreateConnection();
            return await conn.QueryFirstOrDefaultAsync<EventAdmin>(
                "SELECT * FROM event_admins WHERE event_id=@EventId AND user_id=@UserId",
                new { EventId = eventId, UserId = JwtHelper.GetUserId(user) });
        }

        public async Task<bool> CanAsync(ulong eventId, ClaimsPrincipal user, Func<EventAdmin, bool> need)
        {
            var p = await PermissionsAsync(eventId, user);
            return p is not null && need(p);
        }

        /// <summary>Guests may open an event only while it is Active or Completed.</summary>
        public async Task<bool> GuestCanOpenEventAsync(ulong eventId)
        {
            using var conn = _db.CreateConnection();
            var status = await conn.QueryFirstOrDefaultAsync<string>(
                "SELECT status FROM events WHERE event_id=@EventId", new { EventId = eventId });
            return status is not null && GuestVisibleStatuses.Contains(status);
        }

        /// <summary>
        /// Admins: can_view on the photo's event. Guests: the photo must be in
        /// one of their own search results -- a guest can never browse a gallery.
        /// </summary>
        public async Task<bool> CanViewPhotoAsync(Photo photo, ClaimsPrincipal user)
        {
            if (user.IsSuperAdmin()) return true;
            if (user.IsInRole(Roles.EventAdmin) && await CanAsync(photo.EventId, user, p => p.CanView)) return true;
            using var conn = _db.CreateConnection();
            var n = await conn.ExecuteScalarAsync<long>(@"
                SELECT COUNT(*) FROM search_matches sm
                JOIN searches s ON s.search_id = sm.search_id
                WHERE sm.photo_id = @PhotoId AND s.guest_id = @UserId",
                new { PhotoId = photo.PhotoId, UserId = JwtHelper.GetUserId(user) });
            return n > 0;
        }

        /// <summary>Owner of the search, a SuperAdmin, or an admin of that event.</summary>
        public async Task<bool> CanViewSearchAsync(ulong searchId, ClaimsPrincipal user)
        {
            using var conn = _db.CreateConnection();
            var s = await conn.QueryFirstOrDefaultAsync<(ulong EventId, ulong? GuestId)>(
                "SELECT event_id, guest_id FROM searches WHERE search_id=@SearchId", new { SearchId = searchId });
            if (s == default) return false;
            if (s.GuestId == JwtHelper.GetUserId(user)) return true;
            return await CanAsync(s.EventId, user, p => p.CanView);
        }
    }
}
