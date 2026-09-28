import { Camera, KeyRound, Phone, User } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/overlay'
import { Avatar, Field, Input, PageHeader, Skeleton } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { timeAgo } from '../../lib/utils'
import { changePassword, updateProfile, uploadAvatar } from '../../services/authService'
import { getSettings, updateSetting } from '../../services/userService'

function Card({ title, description, children }) {
  return (
    <section className="grid gap-5 rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:grid-cols-[240px_1fr] sm:p-6">
      <div>
        <h2 className="font-semibold text-navy-950">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-navy-500">{description}</p>}
      </div>
      <div className="grid content-start gap-5">{children}</div>
    </section>
  )
}

export function ProfileCard() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const fileRef = useRef(null)
  const [name, setName] = useState(user.name)
  const [phone, setPhone] = useState(user.phone || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    if (name.trim().length < 2) return setError('Enter your full name.')
    setError('')
    setSaving(true)
    try {
      setUser(await updateProfile({ name: name.trim(), phone: phone.trim() }))
      toast('Profile saved')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const avatar = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      setUser(await uploadAvatar(file))
      toast('Photo updated')
    } catch (e) {
      toast(e.message, { tone: 'error' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card title="Profile" description="Your name and contact details.">
      <div className="flex items-center gap-4">
        <Avatar user={{ ...user, name }} size={56} />
        <div>
          <p className="text-sm text-navy-500">{user.email}</p>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => (avatar(e.target.files?.[0]), (e.target.value = ''))} />
          <Button size="sm" variant="secondary" className="mt-2" loading={uploading} onClick={() => fileRef.current?.click()}>
            <Camera /> Change photo
          </Button>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Full name" htmlFor="set-name" error={error}>
          <Input id="set-name" icon={User} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="set-phone" optional>
          <Input id="set-phone" icon={Phone} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} loading={saving} disabled={name === user.name && phone === (user.phone || '')}>
          Save profile
        </Button>
      </div>
    </Card>
  )
}

export function PasswordCard() {
  const toast = useToast()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async (e) => {
    e.preventDefault()
    if (form.next.length < 6) return setError('Use at least 6 characters.')
    if (form.next !== form.confirm) return setError('The new passwords don’t match.')
    setError('')
    setSaving(true)
    try {
      await changePassword(form.current, form.next)
      setForm({ current: '', next: '', confirm: '' })
      toast('Password changed')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card title="Password" description="Use a password you don’t use anywhere else.">
      <form onSubmit={save} className="grid gap-5" noValidate>
        <Field label="Current password" htmlFor="pw-cur">
          <Input id="pw-cur" type="password" icon={KeyRound} autoComplete="current-password" value={form.current} onChange={set('current')} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="New password" htmlFor="pw-new" error={error}>
            <Input id="pw-new" type="password" autoComplete="new-password" value={form.next} onChange={set('next')} aria-invalid={!!error} />
          </Field>
          <Field label="Confirm new password" htmlFor="pw-confirm">
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving} disabled={!form.current || !form.next}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  )
}

function SettingRow({ s }) {
  const toast = useToast()
  const [value, setValue] = useState(s.value)
  const [saving, setSaving] = useState(false)
  const save = async () => {
    setSaving(true)
    try {
      await updateSetting(s.key, value)
      toast('Setting saved', { description: s.key })
    } catch (e) {
      toast(e.message, { tone: 'error' })
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="grid gap-2 border-b border-navy-100 pb-4 last:border-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={`s-${s.key}`} className="font-mono text-[13px] font-medium text-navy-900">
          {s.key}
        </label>
        {s.updatedAt && (
          <span className="text-[12px] text-navy-400">
            Updated {timeAgo(s.updatedAt)}
            {s.updatedByName && ` by ${s.updatedByName}`}
          </span>
        )}
      </div>
      {s.description && <p className="text-[13px] text-navy-500">{s.description}</p>}
      <div className="flex gap-2">
        <Input id={`s-${s.key}`} value={value} onChange={(e) => setValue(e.target.value)} className="h-10" />
        <Button variant="secondary" onClick={save} loading={saving} disabled={value === s.value}>
          Save
        </Button>
      </div>
    </div>
  )
}

function PlatformCard() {
  const { data, loading, error } = useQuery(getSettings, [], { live: false })
  return (
    <Card title="Platform settings" description="Stored in system_settings. face_similarity_threshold controls how strict face matching is (lower finds more, higher is stricter).">
      {loading ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : error ? (
        <p className="text-sm text-bad">{error.message}</p>
      ) : !data.length ? (
        <p className="text-sm text-navy-500">No rows in system_settings yet.</p>
      ) : (
        data.map((s) => <SettingRow key={s.key} s={s} />)
      )}
    </Card>
  )
}

export default function Settings() {
  useDocumentTitle('Settings')
  const { user } = useAuth()
  const superAdmin = user.role === 'super_admin'
  return (
    <div className="grid gap-6">
      <PageHeader title="Settings" description={superAdmin ? 'Your account and platform-wide settings.' : 'Your account.'} />
      <ProfileCard />
      <PasswordCard />
      {superAdmin && <PlatformCard />}
    </div>
  )
}
