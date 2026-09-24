// Mock authentication. Same shape a real API would have (login -> session
// with a token + user), but checked against demo users in local storage.
import { commit, db, delay, uid } from './db'

const SESSION_KEY = 'genesishub.demo.session'

export const DEMO_ACCOUNTS = [
  { role: 'super_admin', label: 'Super Admin', email: 'superadmin@genesishub.demo', password: 'demo123', blurb: 'Runs the platform: events, admins, analytics' },
  { role: 'event_admin', label: 'Event Admin', email: 'admin@genesishub.demo', password: 'demo123', blurb: 'Uploads and manages photos for assigned events' },
  { role: 'end_user', label: 'Guest', email: 'user@genesishub.demo', password: 'demo123', blurb: 'Finds their photos with a selfie' },
]

export const ROLE_HOME = { super_admin: '/admin', event_admin: '/event-admin', end_user: '/events' }
export const ROLE_LABEL = { super_admin: 'Super Admin', event_admin: 'Event Admin', end_user: 'Guest' }

export class AuthError extends Error {}

function publicUser(u) {
  const { password: _password, ...rest } = u
  return rest
}

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    const user = db().users.find((u) => u.id === s.userId)
    return user ? { token: s.token, user: publicUser(user) } : null
  } catch {
    return null
  }
}

function start(user) {
  const session = { token: uid('tok'), userId: user.id }
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // private mode: session lasts for this tab only
  }
  return { token: session.token, user: publicUser(user) }
}

export async function login(email, password) {
  await delay(600)
  const user = db().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user || (user.password ?? 'demo123') !== password) {
    throw new AuthError('That email and password don’t match. Try one of the demo accounts.')
  }
  if (user.status === 'Suspended') throw new AuthError('This account is suspended. Contact the event organizer.')
  return start(user)
}

export async function signup({ name, email, password }) {
  await delay(700)
  if (db().users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
    throw new AuthError('An account with this email already exists. Log in instead.')
  }
  const user = {
    id: uid('u'),
    role: 'end_user',
    name: name.trim(),
    email: email.trim(),
    password,
    avatar: null,
    joined: new Date().toISOString().slice(0, 10),
    status: 'Active',
  }
  commit((d) => {
    d.users.push(user)
    // New guests get the two public demo events so the flow has something to show.
    d.guestAccess[user.id] = ['evt-wedding', 'evt-techfest', 'evt-summit']
  })
  return start(user)
}

// Demo Mode: jump straight into a role without typing credentials.
export async function loginAsRole(role) {
  const acct = DEMO_ACCOUNTS.find((a) => a.role === role)
  return login(acct.email, acct.password)
}

export function logout() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}
