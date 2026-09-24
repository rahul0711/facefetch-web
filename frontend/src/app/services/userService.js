// Users and event admins. Mock implementation over db.js.
import { commit, db, delay, uid } from './db'

const strip = ({ password: _p, ...u }) => u

// GET /users?role=
export async function listUsers({ role } = {}) {
  await delay()
  const d = db()
  return d.users
    .filter((u) => !role || u.role === role)
    .map((u) => ({
      ...strip(u),
      assignedEvents: d.assignments.filter((a) => a.userId === u.id).map((a) => a.eventId),
      eventsJoined: (d.guestAccess[u.id] || []).length,
      searches: Object.keys(d.searches[u.id] || {}).length,
    }))
}

// PATCH /users/:id
export async function setUserStatus(id, status) {
  await delay(350)
  commit((d) => {
    d.users.find((u) => u.id === id).status = status
  })
}

// POST /admins/invite
export async function inviteAdmin({ name, email, title }) {
  await delay(600)
  if (db().users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Someone with this email already has an account.')
  }
  const user = {
    id: uid('u'),
    role: 'event_admin',
    name,
    email,
    title: title || 'Event Admin',
    avatar: null,
    joined: new Date().toISOString().slice(0, 10),
    status: 'Invited',
    password: 'demo123',
  }
  commit((d) => {
    d.users.push(user)
    d.activity.unshift({ id: uid('act'), kind: 'user', text: `${name} was invited as an event admin`, event: null, at: new Date().toISOString() })
  })
  return strip(user)
}

export async function updateProfile(id, patch) {
  await delay(400)
  commit((d) => Object.assign(d.users.find((u) => u.id === id), patch))
}

export function userStats(userId) {
  const d = db()
  const searches = d.searches[userId] || {}
  return {
    events: (d.guestAccess[userId] || []).length,
    searched: Object.keys(searches).length,
    found: Object.values(searches).reduce((n, s) => n + s.hits.length, 0),
    favorites: (d.favorites[userId] || []).length,
    downloads: d.downloads[userId] || 0,
  }
}
