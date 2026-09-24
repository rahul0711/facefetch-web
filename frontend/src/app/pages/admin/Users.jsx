import { Ellipsis, Mail, Search, UserPlus, Users as UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import Button from '../../components/ui/Button'
import { Menu, Modal, useToast } from '../../components/ui/overlay'
import { Avatar, Badge, EmptyState, Field, Input, PageHeader, Segmented, Skeleton } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { fmtDate } from '../../lib/utils'
import { db } from '../../services/db'
import { inviteAdmin, listUsers, setUserStatus } from '../../services/userService'

const STATUS_TONE = { Active: 'ok', Invited: 'brand', Suspended: 'bad' }

function InviteModal({ open, onClose }) {
  const toast = useToast()
  const [form, setForm] = useState({ name: '', email: '', title: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    if (form.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setError('Enter a name and a valid email.')
      return
    }
    setSaving(true)
    try {
      await inviteAdmin(form)
      toast('Invite sent', { description: `${form.name} can sign in once they accept.` })
      setForm({ name: '', email: '', title: '' })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite an event admin"
      description="They’ll only see events you assign to them."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="invite-form" loading={saving}>
            <Mail /> Send invite
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Full name" htmlFor="inv-name">
          <Input id="inv-name" data-autofocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ananya Rao" />
        </Field>
        <Field label="Email" htmlFor="inv-email" error={error}>
          <Input id="inv-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ananya@studio.com" aria-invalid={!!error} />
        </Field>
        <Field label="Role or title" htmlFor="inv-title" optional>
          <Input id="inv-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Lead Photographer" />
        </Field>
      </form>
    </Modal>
  )
}

export default function AdminUsers({ tab }) {
  const admins = tab === 'admins'
  useDocumentTitle(admins ? 'Event admins' : 'Users')
  const navigate = useNavigate()
  const toast = useToast()
  const { data: users, loading } = useQuery(() => listUsers({ role: admins ? 'event_admin' : 'end_user' }), [admins])
  const [q, setQ] = useState('')
  const [inviting, setInviting] = useState(false)
  const shown = (users || []).filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase()))
  const eventName = (id) => db().events.find((e) => e.id === id)?.name

  return (
    <div className="grid gap-6">
      <PageHeader
        title={admins ? 'Event admins' : 'Users'}
        description={admins ? 'Photographers and organizers who manage individual events.' : 'Guests who use Genesis Hub to find their photos.'}
        actions={
          admins && (
            <Button onClick={() => setInviting(true)}>
              <UserPlus /> Invite admin
            </Button>
          )
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="User type"
          size="sm"
          value={tab}
          onChange={(v) => navigate(v === 'admins' ? '/admin/admins' : '/admin/users')}
          options={[
            { value: 'guests', label: 'Guests' },
            { value: 'admins', label: 'Event admins' },
          ]}
        />
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
          <EmptyState icon={UsersIcon} title={q ? 'No one matches' : 'No users yet'}>
            {q ? 'Try a different name or email.' : 'Guests appear here once they sign up for an event.'}
          </EmptyState>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-navy-100 bg-navy-50/60 text-[12px] font-medium tracking-wide text-navy-500 uppercase">
              <tr>
                <th className="px-4 py-3 font-medium sm:px-5">Name</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">{admins ? 'Assigned events' : 'Events'}</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Joined</th>
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
                          {u.assignedEvents.slice(0, 2).map((id) => (
                            <Badge key={id}>{eventName(id)}</Badge>
                          ))}
                          {u.assignedEvents.length > 2 && <Badge>+{u.assignedEvents.length - 2}</Badge>}
                        </span>
                      ) : (
                        <span className="text-navy-400">None yet</span>
                      )
                    ) : (
                      <span>
                        {u.eventsJoined} events · {u.searches} searched
                      </span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-navy-500 lg:table-cell">{fmtDate(u.joined)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[u.status]} dot>
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
                      items={[
                        u.status === 'Invited' && { label: 'Resend invite', icon: Mail, onClick: () => toast(`Invite re-sent to ${u.email}`) },
                        u.status !== 'Suspended'
                          ? {
                              label: 'Suspend',
                              danger: true,
                              onClick: async () => {
                                await setUserStatus(u.id, 'Suspended')
                                toast(`${u.name} suspended`, { tone: 'info' })
                              },
                            }
                          : {
                              label: 'Reactivate',
                              onClick: async () => {
                                await setUserStatus(u.id, 'Active')
                                toast(`${u.name} reactivated`)
                              },
                            },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <InviteModal open={inviting} onClose={() => setInviting(false)} />
    </div>
  )
}
