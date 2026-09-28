import { Ellipsis, Eye, EyeOff, KeyRound, Mail, Phone, Search, User, UserPlus, Users as UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../../components/ui/Button'
import { Menu, Modal, useToast } from '../../components/ui/overlay'
import { Avatar, Badge, EmptyState, Field, Input, PageHeader, Segmented, Select, Skeleton } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { fmtDate, timeAgo } from '../../lib/utils'
import { ROLE_LABEL } from '../../services/authService'
import { createUser, listEventAdmins, listUsers, setUserActive } from '../../services/userService'

const EMPTY = { name: '', email: '', phone: '', password: '' }

function randomPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const a = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(a, (n) => chars[n % chars.length]).join('')
}

/** Super Admin creates an account directly (there is no email invite flow). */
export function CreateUserModal({ open, onClose, onCreated, role: fixedRole }) {
  const toast = useToast()
  const [form, setForm] = useState(EMPTY)
  const [role, setRole] = useState(fixedRole || 'event_admin')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const close = () => {
    setForm(EMPTY)
    setErrors({})
    onClose()
  }

  const submit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (form.name.trim().length < 2) errs.name = 'Enter their full name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Enter a valid email.'
    if (form.password.length < 6) errs.password = 'Use at least 6 characters.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    setSaving(true)
    try {
      const u = await createUser({ ...form, role })
      toast(`${ROLE_LABEL[role]} account created`, { description: `Share the email and password with ${form.name.trim()} so they can sign in.` })
      onCreated?.(u)
      close()
    } catch (err) {
      setErrors({ email: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={fixedRole === 'event_admin' ? 'Create an event admin' : 'Create an account'}
      description="They sign in with this email and password. Event admins only see events you assign to them."
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="create-user-form" loading={saving}>
            <UserPlus /> Create account
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={submit} className="grid gap-4" noValidate>
        {!fixedRole && (
          <Field label="Role" htmlFor="cu-role" hint={role === 'super_admin' ? 'Full control of every event, user and setting.' : 'Creates events and uploads and manages their photos.'}>
            <Select id="cu-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="event_admin">Event Admin</option>
              <option value="super_admin">Super Admin</option>
            </Select>
          </Field>
        )}
        <Field label="Full name" htmlFor="cu-name" error={errors.name}>
          <Input id="cu-name" icon={User} data-autofocus value={form.name} onChange={set('name')} placeholder="Ananya Rao" aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="cu-email" error={errors.email}>
          <Input id="cu-email" icon={Mail} type="email" value={form.email} onChange={set('email')} placeholder="ananya@studio.com" aria-invalid={!!errors.email} />
        </Field>
        <Field label="Phone" htmlFor="cu-phone" optional>
          <Input id="cu-phone" icon={Phone} type="tel" value={form.phone} onChange={set('phone')} />
        </Field>
        <Field label="Password" htmlFor="cu-pass" error={errors.password} hint="They can change it later in Settings.">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input id="cu-pass" icon={KeyRound} type={show ? 'text' : 'password'} value={form.password} onChange={set('password')} autoComplete="new-password" aria-invalid={!!errors.password} className="pr-10" />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-navy-400 hover:text-navy-800" aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setForm((f) => ({ ...f, password: randomPassword() }))
                setShow(true)
              }}
            >
              Generate
            </Button>
          </div>
        </Field>
      </form>
    </Modal>
  )
}

export default function AdminUsers({ tab }) {
  const admins = tab === 'admins'
  useDocumentTitle(admins ? 'Event admins' : 'Accounts')
  const navigate = useNavigate()
  const toast = useToast()
  const { data: users, loading } = useQuery(() => (admins ? listEventAdmins() : listUsers()), [admins])
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [creating, setCreating] = useState(false)
  const shown = (users || []).filter((u) => (admins || role === 'all' || u.role === role) && `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()))

  const toggleActive = async (u) => {
    try {
      await setUserActive(u.id, !u.isActive)
      toast(`${u.name} ${u.isActive ? 'deactivated' : 'reactivated'}`, { tone: u.isActive ? 'info' : 'success' })
    } catch (e) {
      toast(e.message, { tone: 'error' })
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title={admins ? 'Event admins' : 'Accounts'}
        description={admins ? 'Photographers and organizers who create and manage events.' : 'Admin accounts. Guests don’t need one: see Visitors for who searched.'}
        actions={
          <Button onClick={() => setCreating(true)}>
            <UserPlus /> {admins ? 'Add event admin' : 'Add account'}
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="User list"
          size="sm"
          value={tab}
          onChange={(v) => navigate(v === 'admins' ? '/admin/admins' : '/admin/users')}
          options={[
            { value: 'guests', label: 'All accounts' },
            { value: 'admins', label: 'Event admins' },
          ]}
        />
        {!admins && (
          <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className="h-10 w-40">
            <option value="all">All roles</option>
            <option value="event_admin">Event Admins</option>
            <option value="super_admin">Super Admins</option>
          </Select>
        )}
        <div className="ml-auto w-full sm:w-64">
          <Input icon={Search} placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" className="h-10" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card">
        {loading ? (
          <div className="grid gap-3 p-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !shown.length ? (
          <EmptyState
            icon={UsersIcon}
            title={q ? 'No one matches' : admins ? 'No event admins yet' : 'No accounts yet'}
            action={!q && <Button onClick={() => setCreating(true)}><UserPlus /> {admins ? 'Add event admin' : 'Add account'}</Button>}
          >
            {q ? 'Try a different name or email.' : admins ? 'Create an event admin. They can create their own events or be assigned to yours.' : 'Create an admin account to get started.'}
          </EmptyState>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/60 text-[12px] font-medium tracking-wide text-navy-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium sm:px-5">Name</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">{admins ? 'Assigned events' : 'Role'}</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Joined</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Last sign-in</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="w-12 px-4 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-100">
              {shown.map((u) => (
                <tr key={u.id} className="hover:bg-navy-50/40">
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                      <Avatar user={u} size={36} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-navy-900">{u.name}</p>
                        <p className="truncate text-[13px] text-navy-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-navy-600 md:table-cell">
                    {admins ? (
                      u.assignedEvents.length ? (
                        <span className="flex flex-wrap gap-1">
                          {u.assignedEvents.slice(0, 2).map((e) => (
                            <Badge key={e.eventId}>{e.name}</Badge>
                          ))}
                          {u.assignedEvents.length > 2 && <Badge>+{u.assignedEvents.length - 2}</Badge>}
                        </span>
                      ) : (
                        <span className="text-navy-400">None yet</span>
                      )
                    ) : (
                      <Badge tone={u.role === 'super_admin' ? 'brand' : 'neutral'}>{ROLE_LABEL[u.role]}</Badge>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-navy-500 lg:table-cell">{fmtDate(u.joined)}</td>
                  <td className="hidden px-4 py-3 text-navy-500 lg:table-cell">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</td>
                  <td className="px-4 py-3">
                    <Badge tone={u.isActive ? 'ok' : 'bad'} dot>
                      {u.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Menu
                      trigger={({ toggle, open }) => (
                        <button onClick={toggle} aria-expanded={open} aria-label={`Actions for ${u.name}`} className="grid size-8 place-items-center rounded-lg text-navy-400 hover:bg-navy-100 hover:text-navy-800">
                          <Ellipsis className="size-4" />
                        </button>
                      )}
                      items={[u.isActive ? { label: 'Deactivate', danger: true, onClick: () => toggleActive(u) } : { label: 'Reactivate', onClick: () => toggleActive(u) }]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <CreateUserModal open={creating} onClose={() => setCreating(false)} role={admins ? 'event_admin' : undefined} />
    </div>
  )
}
