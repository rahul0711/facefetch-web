// Real authentication against the C# backend (JWT).
import { api, readSession, writeSession } from './api'
import { toUser } from './adapters'

export const ROLE_HOME = { super_admin: '/admin', event_admin: '/event-admin', end_user: '/events' }
export const ROLE_LABEL = { super_admin: 'Super Admin', event_admin: 'Event Admin', end_user: 'Guest' }

export function getSession() {
  const s = readSession()
  return s ? { token: s.token, user: s.user } : null
}

async function startSession(loginData) {
  const session = { token: loginData.token, expiresAt: loginData.expiresAt, user: null }
  writeSession(session)
  // /me gives the full profile (phone, active flag...) with the same shape everywhere
  const me = await api('/api/auth/me')
  session.user = toUser(me)
  writeSession(session)
  return { token: session.token, user: session.user }
}

export async function login(email, password) {
  const data = await api('/api/auth/login', { method: 'POST', json: { email: email.trim(), password } })
  return startSession(data)
}

export async function signup({ name, email, password, phone }) {
  await api('/api/auth/signup', { method: 'POST', json: { fullName: name.trim(), email: email.trim(), password, phone: phone || null } })
  return login(email, password)
}

export async function refreshMe() {
  const s = readSession()
  if (!s) return null
  const user = toUser(await api('/api/auth/me'))
  writeSession({ ...s, user })
  return user
}

export async function updateProfile({ name, phone }) {
  await api('/api/auth/me', { method: 'PUT', json: { fullName: name, phone: phone || null } })
  return refreshMe()
}

export async function changePassword(currentPassword, newPassword) {
  await api('/api/auth/change-password', { method: 'POST', json: { currentPassword, newPassword } })
}

export async function uploadAvatar(file) {
  const form = new FormData()
  form.append('file', file)
  await api('/api/auth/upload-avatar', { method: 'POST', form })
  return refreshMe()
}

export function logout() {
  writeSession(null)
  try {
    sessionStorage.clear()
  } catch {
    // ignore
  }
}
