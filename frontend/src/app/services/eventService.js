// Events + event-admin assignments (C# backend).
import { api } from './api'
import { toEvent, toPerms } from './adapters'
import { emitChange } from './bus'

export class AccessError extends Error {}

const byDateDesc = (a, b) => (b.date || '').localeCompare(a.date || '') || b.eventId - a.eventId

// GET /api/events -- the backend already filters by role:
// SuperAdmin all, EventAdmin assigned, Guest Active + Completed.
export async function listEvents({ status } = {}) {
  const q = status && status !== 'All' ? `?status=${encodeURIComponent(status)}` : ''
  return (await api(`/api/events${q}`)).map(toEvent).sort(byDateDesc)
}

export const listGuestEvents = () => listEvents()

// An event page for anyone (404 if not visible to this user).
export async function getGuestEvent(eventId) {
  try {
    return toEvent(await api(`/api/events/id/${eventId}`))
  } catch (e) {
    if (e.status === 404) throw new AccessError('This event isn’t available.')
    throw e
  }
}

export const getEvent = getGuestEvent

// Event admin: assigned events with own permissions.
export async function listAdminEvents() {
  return (await api('/api/eventadmin/myevents')).map(toEvent).sort(byDateDesc)
}

export async function myPermissions(eventId) {
  return toPerms(await api(`/api/eventadmin/${eventId}/permissions`))
}

export function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 100)
}

const toRequest = (d) => ({
  eventName: d.name.trim(),
  eventCode: d.code,
  description: d.description?.trim() || null,
  eventDate: d.date || null,
  location: d.location?.trim() || null,
  status: d.status,
})

export async function createEvent(data) {
  const ev = toEvent(await api('/api/events', { method: 'POST', json: toRequest(data) }))
  emitChange()
  return ev
}

export async function updateEvent(eventId, data) {
  const { eventCode: _code, ...body } = toRequest(data)
  const ev = toEvent(await api(`/api/events/${eventId}`, { method: 'PUT', json: body }))
  emitChange()
  return ev
}

export async function setEventStatus(eventId, status) {
  await api(`/api/events/${eventId}/status`, { method: 'PATCH', json: { status } })
  emitChange()
}

export const archiveEvent = (eventId) => setEventStatus(eventId, 'Archived')

export async function uploadCover(eventId, file) {
  const form = new FormData()
  form.append('file', file)
  const r = await api(`/api/events/${eventId}/cover`, { method: 'POST', form })
  emitChange()
  return r
}

export async function deleteCover(eventId) {
  await api(`/api/events/${eventId}/cover`, { method: 'DELETE' })
  emitChange()
}

// ── admins of one event (SuperAdmin) ─────────────────────────────────────
export async function listEventAssignments(eventId) {
  const rows = await api(`/api/events/${eventId}/admins`)
  return rows.map((r) => ({ userId: r.userId, name: r.userFullName, email: r.userEmail, perms: toPerms(r) }))
}

/** Make the event's admin list equal `entries` [{userId, perms}] (assign / update / remove). */
export async function setEventAdmins(eventId, entries, current) {
  const next = new Map(entries.map((e) => [e.userId, e.perms]))
  for (const c of current) {
    if (!next.has(c.userId)) await api(`/api/events/${eventId}/admins/${c.userId}`, { method: 'DELETE' })
  }
  for (const [userId, perms] of next) {
    await api(`/api/events/${eventId}/admins`, { method: 'POST', json: { userId, ...perms } })
  }
  emitChange()
}
