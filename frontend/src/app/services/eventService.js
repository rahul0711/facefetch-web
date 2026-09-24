// Events + event-admin assignments. Mock implementation over db.js; each
// function maps 1:1 to a future REST endpoint (noted per function).
import { commit, db, delay, uid } from './db'

const withCounts = (ev) => {
  const d = db()
  const photos = d.photos.filter((p) => p.eventId === ev.id)
  const admins = d.assignments
    .filter((a) => a.eventId === ev.id)
    .map((a) => d.users.find((u) => u.id === a.userId))
    .filter(Boolean)
  return { ...ev, sampleCount: photos.length, admins }
}

const byDateDesc = (a, b) => b.date.localeCompare(a.date)

// GET /events
export async function listEvents({ status } = {}) {
  await delay()
  return db()
    .events.filter((e) => !status || status === 'All' || e.status === status)
    .sort(byDateDesc)
    .map(withCounts)
}

// GET /events/:id
export async function getEvent(id) {
  await delay(250)
  const ev = db().events.find((e) => e.id === id || e.slug === id)
  if (!ev) throw new Error('Event not found')
  return withCounts(ev)
}

// GET /me/events (guest) -- only events the guest was invited to, never drafts
export async function listGuestEvents(userId) {
  await delay()
  const d = db()
  const allowed = new Set(d.guestAccess[userId] || [])
  return d.events
    .filter((e) => allowed.has(e.id) && e.status !== 'Draft' && e.status !== 'Archived')
    .sort(byDateDesc)
    .map(withCounts)
}

export class AccessError extends Error {}

// GET /me/events/:id (guest) -- 403 unless the guest was invited
export async function getGuestEvent(eventId, userId) {
  await delay(250)
  const d = db()
  const ev = d.events.find((e) => e.id === eventId)
  if (!ev || ev.status === 'Draft') throw new Error('Event not found')
  if (!(d.guestAccess[userId] || []).includes(eventId)) throw new AccessError('You don’t have access to this event.')
  return withCounts(ev)
}

// GET /me/assigned-events (event admin) -- strictly the events assigned to them
export async function listAdminEvents(userId) {
  await delay()
  const d = db()
  return d.assignments
    .filter((a) => a.userId === userId)
    .map((a) => ({ ...withCounts(d.events.find((e) => e.id === a.eventId)), perms: a.perms }))
    .filter((e) => e.id)
    .sort(byDateDesc)
}

export function adminPerms(userId, eventId) {
  return db().assignments.find((a) => a.userId === userId && a.eventId === eventId)?.perms || null
}

export function slugify(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_-]+/g, '-')
    .slice(0, 60)
}

// POST /events
export async function createEvent(data) {
  await delay(700)
  if (db().events.some((e) => e.slug === data.slug)) throw new Error('That URL slug is already taken.')
  const ev = {
    id: uid('evt'),
    pool: null,
    stats: { photos: 0, faces: 0, searches: 0, visitors: 0, downloads: 0 },
    createdAt: new Date().toISOString(),
    subtitle: data.subtitle || data.type,
    ...data,
  }
  commit((d) => {
    d.events.push(ev)
    d.activity.unshift({ id: uid('act'), kind: 'event', text: `${ev.name} was created`, event: ev.name, at: new Date().toISOString() })
  })
  return ev
}

// PATCH /events/:id
export async function updateEvent(id, patch) {
  await delay(500)
  commit((d) => {
    const ev = d.events.find((e) => e.id === id)
    Object.assign(ev, patch)
  })
  return getEvent(id)
}

export async function archiveEvent(id) {
  return updateEvent(id, { status: 'Archived' })
}

// GET /events/:id/admins
export async function listEventAssignments(eventId) {
  await delay(250)
  return db().assignments.filter((a) => a.eventId === eventId)
}

// PUT /events/:id/admins  -- replaces the event's admin list
export async function setEventAdmins(eventId, entries) {
  await delay(600)
  commit((d) => {
    const before = new Set(d.assignments.filter((a) => a.eventId === eventId).map((a) => a.userId))
    d.assignments = d.assignments.filter((a) => a.eventId !== eventId).concat(entries.map((e) => ({ ...e, eventId })))
    const ev = d.events.find((e) => e.id === eventId)
    for (const e of entries) {
      if (!before.has(e.userId)) {
        const u = d.users.find((x) => x.id === e.userId)
        d.activity.unshift({ id: uid('act'), kind: 'assign', text: `${u.name} was assigned as event admin`, event: ev.name, at: new Date().toISOString() })
      }
    }
  })
}
