# Genesis Hub API

ASP.NET Core 8 backend. It owns the users, events, photos, files and the MySQL
database. The Python server (`app/web/face_search_server.py`, port 8002) only does
the AI work: face detection and face signatures.

Every response uses the same shape: `{ "success": bool, "message": string, "data": ... }`.
Authenticated calls send the header `Authorization: Bearer <token>`, where the token comes from `/api/auth/login`.
For `<img src>` (and photo downloads), pass the token as `?access_token=<token>` on the photo image,
thumbnail and download URLs.

Roles: `SuperAdmin`, `EventAdmin`, `Guest`. An event admin only sees events assigned
to them, limited by `can_view`, `can_upload`, `can_delete` and `can_manage`. Guests
see only `Active` and `Completed` events, and only the photos their own searches found.

## Auth
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/auth/login` | anyone | `{email, password}` → `{token, role, userId, fullName, ...}` |
| POST | `/api/auth/signup` | anyone | creates a **Guest** |
| GET | `/api/auth/me` | logged in | |
| PUT | `/api/auth/me` | logged in | `{fullName, phone}` |
| POST | `/api/auth/change-password` | logged in | `{currentPassword, newPassword}` |
| POST | `/api/auth/upload-avatar` | logged in | multipart `file`; saved compressed (256 px, public) |

## Events
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/events?status=` | anyone | SuperAdmin: all · EventAdmin: assigned · Guest/anonymous: Active + Completed |
| GET | `/api/events/{eventCode}` | anyone | 404 if the event isn't visible to you |
| GET | `/api/events/id/{id}` | anyone | same rules |
| GET | `/api/events/my` | EventAdmin, SuperAdmin | includes `myPermissions` |
| POST | `/api/events` | SuperAdmin | `{eventName, eventCode, description, eventDate: "yyyy-MM-dd", location, status}` |
| PUT | `/api/events/{id}` | SuperAdmin / `can_manage` | |
| PATCH | `/api/events/{id}/status` | SuperAdmin / `can_manage` | `{status: Draft\|Active\|Completed\|Archived}` |
| POST | `/api/events/{id}/cover` | SuperAdmin / `can_manage` | multipart `file`; saved compressed |
| DELETE | `/api/events/{id}/cover` | SuperAdmin / `can_manage` | |
| GET | `/api/events/{id}/cover` | anyone (visible events) | JPEG |
| GET | `/api/events/{id}/stats` | `can_view` | photos by status, faces, searches, visitors, downloads, storage |
| GET | `/api/events/{id}/analytics?days=30` | `can_view` | daily searches/uploads/downloads + totals |
| GET | `/api/events/{id}/admins` | SuperAdmin | |
| POST | `/api/events/{id}/admins` | SuperAdmin | `{userId, canView, canUpload, canDelete, canManage}` (assign or update) |
| PATCH | `/api/events/{id}/admins/{userId}/permissions` | SuperAdmin | |
| DELETE | `/api/events/{id}/admins/{userId}` | SuperAdmin | |

## Event admin console
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/eventadmin/myevents` | EventAdmin, SuperAdmin | with `myPermissions` |
| GET | `/api/eventadmin/dashboard?days=30` | EventAdmin, SuperAdmin | totals and charts across my events, plus stats per event |
| GET | `/api/eventadmin/{eventId}/permissions` | assigned | |
| GET | `/api/eventadmin/{eventId}/photos?status=&page=&pageSize=` | `can_view` | paged |
| POST | `/api/eventadmin/{eventId}/photos` | `can_upload` | multipart `files` (many). Each file is compressed, stored, analyzed → per-file result |
| POST | `/api/eventadmin/{eventId}/photos/{photoId}/reanalyze` | `can_upload`/`can_manage` | |
| POST | `/api/eventadmin/{eventId}/photos/reanalyze-failed` | `can_upload`/`can_manage` | retries every Failed photo |
| DELETE | `/api/eventadmin/{eventId}/photos/{photoId}` | `can_delete` | |
| POST | `/api/eventadmin/{eventId}/photos/bulk-delete` | `can_delete` | `{photoIds: []}` |
| GET | `/api/eventadmin/{eventId}/downloads` | `can_view` | download log |

## Photos
| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/api/photos/event/{eventId}` | `can_view` | same as the event admin list |
| GET | `/api/photos/{id}` | anyone allowed to see it | admins also get `faces` |
| GET | `/api/photos/{id}/faces` | `can_view` | boxes in pixels + `box: [x1,y1,x2,y2]` as 0..1 |
| GET | `/api/photos/{id}/image` | allowed viewers | compressed JPEG (max 2560 px) |
| GET | `/api/photos/{id}/thumbnail` | allowed viewers | 480 px JPEG |
| GET | `/api/photos/{id}/download` | allowed viewers | logged as `Single` |
| POST | `/api/photos/download-zip` | logged in | `{photoIds: []}`, max 500. Only photos you may see; logged as `Zip` |
| POST | `/api/photos/upload/{eventId}` | `can_upload` | same as the event admin upload |
| POST | `/api/photos/{id}/reanalyze` | `can_upload`/`can_manage` | |
| DELETE | `/api/photos/{id}` | `can_delete` | |
| POST | `/api/photos/bulk-delete` | `can_delete` per photo | `{photoIds: []}` |

"Allowed viewers" means a SuperAdmin, an admin of the event with `can_view`, or a guest whose search found that photo.

## Face search (guests)
| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/search/{eventId}` | logged in | multipart `selfies` (1-5 frames) or `selfie`. The selfie is **not stored**. The threshold comes from `system_settings`, not from the client. Returns matches with `matchedFace`. 422 = no face / too small, 503 = AI offline |
| GET | `/api/search/{searchId}/results` | owner / event admins | |
| GET | `/api/search/my` | logged in | my searches |
| GET | `/api/search/my/latest/{eventId}` | logged in | my latest results for an event |
| GET | `/api/search/my/photos` | logged in | every photo I've been found in |
| DELETE | `/api/search/my` | logged in | clear my history (I also lose access to those photos) |
| GET | `/api/search/event/{eventId}` | `can_view` | searches in an event |

## Super admin
| Method | Path | Notes |
|---|---|---|
| GET | `/api/admin/dashboard` | totals + recent activity |
| GET | `/api/admin/analytics?days=30` | platform totals, daily series, photo status, top events |
| GET | `/api/admin/users?role=&search=` | |
| GET | `/api/admin/users/{id}` | |
| POST | `/api/admin/users` | `{fullName, email, password, phone, roleName}`, e.g. create an Event Admin |
| GET | `/api/admin/event-admins` | every Event Admin with their assigned events + permissions |
| PATCH | `/api/admin/users/{id}/role` · `/activate` · `/deactivate` | |
| GET / PUT | `/api/admin/settings` · `/api/admin/settings/{key}` | `face_similarity_threshold` (0-1), `max_upload_size_mb`, `allowed_image_types` |
| GET | `/api/admin/logs?page=&pageSize=` | activity log |
| GET | `/api/admin/roles` | |

## Health
`GET /api/health` → `{database: ok|down, faceEngine: ok|down}`

## Configuration (appsettings.json or environment variables)
- `ConnectionStrings:DefaultConnection`: MySQL.
- `AiServer:BaseUrl`: the Python server, e.g. `https://localhost:8002`. Set `AiServer:IgnoreSslErrors` to `true` for its self-signed certificate.
- `FileStorage:Root`: where photos, thumbnails and covers are saved (default `./storage`, **not** public). Related settings are `MaxSidePx` (2560), `JpegQuality` (85) and `ThumbnailSidePx` (480).
- `Cors:Origins`: extra frontend origins for production.
- `Bootstrap:SuperAdminEmail` / `SuperAdminPassword` / `SuperAdminName`: create the **first** Super Admin on startup, only if none exists yet. Remove them afterwards.
