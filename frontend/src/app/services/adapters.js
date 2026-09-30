// Backend DTOs -> the shapes the UI components use. Keeping this mapping in
// one place means pages don't care about backend field names.
import { withToken } from './api'

export const ROLE_FROM_API = { SuperAdmin: 'super_admin', EventAdmin: 'event_admin', Guest: 'end_user' }
export const ROLE_TO_API = { super_admin: 'SuperAdmin', event_admin: 'EventAdmin', end_user: 'Guest' }

export const EVENT_STATUSES = ['Draft', 'Active', 'Completed', 'Archived']
// Guests can open (and search) only these.
export const GUEST_STATUSES = ['Active', 'Completed']

export const PERMISSIONS = [
  { key: 'canView', short: 'View', label: 'View event & photos', hint: 'See the event, its gallery, stats and searches' },
  { key: 'canUpload', short: 'Upload', label: 'Upload photos', hint: 'Add photos and re-run face analysis' },
  { key: 'canDelete', short: 'Delete', label: 'Delete photos', hint: 'Remove photos from the gallery' },
  { key: 'canManage', short: 'Manage', label: 'Manage event', hint: 'Edit details, status and cover image' },
]

export function toUser(u) {
  if (!u) return null
  const roleName = u.roleName ?? u.role
  return {
    id: u.userId,
    name: u.fullName,
    email: u.email,
    phone: u.phone || '',
    avatar: u.profileImage || null,
    roleName,
    role: ROLE_FROM_API[roleName] || 'end_user',
    isActive: u.isActive !== false,
    status: u.isActive === false ? 'Deactivated' : 'Active',
    joined: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  }
}

export function toPerms(p) {
  if (!p) return null
  return { canView: !!p.canView, canUpload: !!p.canUpload, canDelete: !!p.canDelete, canManage: !!p.canManage }
}

export function toEvent(e) {
  if (!e) return null
  return {
    id: String(e.eventId),
    eventId: e.eventId,
    name: e.eventName,
    code: e.eventCode,
    description: e.description || '',
    date: e.eventDate ? String(e.eventDate).slice(0, 10) : null,
    location: e.location || '',
    coverUrl: e.coverUrl || null,
    cover: e.coverUrl ? withToken(e.coverUrl) : null,
    status: e.status,
    photoCount: e.photoCount ?? 0,
    createdBy: e.createdBy,
    createdByName: e.createdByName,
    createdAt: e.createdAt,
    perms: toPerms(e.myPermissions),
  }
}

const PHOTO_STATUS = { Pending: 'analyzing', Processing: 'analyzing', Completed: 'processed', Failed: 'failed' }

export function toPhoto(p) {
  return {
    id: p.photoId,
    eventId: p.eventId,
    name: p.originalFileName,
    alt: p.originalFileName,
    src: withToken(p.thumbnailUrl),
    full: withToken(p.imageUrl),
    downloadPath: p.downloadUrl,
    width: p.width || 4,
    height: p.height || 3,
    faceCount: p.faceCount ?? 0,
    faces: (p.faces || []).map((f) => f.box),
    status: PHOTO_STATUS[p.status] || 'analyzing',
    rawStatus: p.status,
    error: p.errorMessage || null,
    takenAt: p.uploadedAt,
    uploadedByName: p.uploadedByName,
    fileSize: p.fileSize,
  }
}

// key: the search's access key; lets a visitor without an account download
// (and zip) the matched photos. The photo URLs already include it.
export function toMatch(m, key = null) {
  return {
    photoId: m.photoId,
    score: m.similarityScore,
    box: m.matchedFace?.box || null,
    photo: {
      id: m.photoId,
      eventId: m.eventId,
      name: m.originalFileName,
      alt: m.originalFileName,
      src: withToken(m.thumbnailUrl),
      full: withToken(m.imageUrl),
      downloadPath: m.downloadUrl,
      key,
      width: m.width || 4,
      height: m.height || 3,
      faceCount: m.faceCount ?? 0,
      takenAt: m.uploadedAt,
    },
  }
}

export function toSearch(s) {
  return {
    searchId: s.searchId,
    eventId: String(s.eventId),
    eventName: s.eventName,
    at: s.completedAt || s.startedAt,
    status: s.searchStatus,
    matchCount: s.matchCount,
    accessKey: s.accessKey || null,
    hits: (s.matches || []).map((m) => toMatch(m, s.accessKey || null)),
  }
}
