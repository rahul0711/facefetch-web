// Users, event admins and platform settings (SuperAdmin endpoints).
import { api } from './api'
import { ROLE_TO_API, toPerms, toUser } from './adapters'
import { emitChange } from './bus'

export async function listUsers({ role, search } = {}) {
  const q = new URLSearchParams()
  if (role) q.set('role', ROLE_TO_API[role] || role)
  if (search) q.set('search', search)
  return (await api(`/api/admin/users?${q}`)).map(toUser)
}

/** Every EventAdmin with the events they're assigned to (+ permissions). */
export async function listEventAdmins() {
  const rows = await api('/api/admin/event-admins')
  return rows.map((r) => ({
    ...toUser(r),
    assignedEvents: (r.assignedEvents || []).map((a) => ({ eventId: String(a.eventId), name: a.eventName, status: a.status, perms: toPerms(a) })),
  }))
}

/** role: 'event_admin' | 'super_admin' | 'end_user' */
export async function createUser({ name, email, password, phone, role = 'event_admin' }) {
  const r = await api('/api/admin/users', {
    method: 'POST',
    json: { fullName: name.trim(), email: email.trim(), password, phone: phone || null, roleName: ROLE_TO_API[role] },
  })
  emitChange()
  return r
}

export async function setUserActive(userId, active) {
  await api(`/api/admin/users/${userId}/${active ? 'activate' : 'deactivate'}`, { method: 'PATCH' })
  emitChange()
}

export async function getSettings() {
  const pick = (r, k) => r[k] ?? r[k[0].toUpperCase() + k.slice(1)]
  return (await api('/api/admin/settings')).map((r) => ({
    key: pick(r, 'settingKey'),
    value: pick(r, 'settingValue') ?? '',
    description: pick(r, 'description') || '',
    updatedAt: pick(r, 'updatedAt'),
    updatedByName: pick(r, 'updatedByName'),
  }))
}

export async function updateSetting(key, value) {
  await api(`/api/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', json: { settingValue: String(value) } })
  emitChange()
}
