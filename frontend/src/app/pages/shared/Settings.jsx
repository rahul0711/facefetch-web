import { useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/overlay'
import { Avatar, Field, Input, PageHeader, Select, Switch } from '../../components/ui/primitives'
import { useDocumentTitle } from '../../lib/hooks'
import { updateProfile } from '../../services/userService'

function Card({ title, description, children }) {
  return (
    <section className="grid gap-5 rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:grid-cols-[240px_1fr] sm:p-6">
      <div>
        <h2 className="font-semibold text-navy-950">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-navy-500">{description}</p>}
      </div>
      <div className="grid gap-5">{children}</div>
    </section>
  )
}

export default function Settings() {
  useDocumentTitle('Settings')
  const { user } = useAuth()
  const toast = useToast()
  const superAdmin = user.role === 'super_admin'
  const [name, setName] = useState(user.name)
  const [title, setTitle] = useState(user.title || '')
  const [saving, setSaving] = useState(false)
  const [notify, setNotify] = useState({ uploads: true, digest: true, failures: true })
  const [platform, setPlatform] = useState({ retention: '30', downloads: true, watermark: false })

  const save = async () => {
    setSaving(true)
    await updateProfile(user.id, { name: name.trim() || user.name, title })
    setSaving(false)
    toast('Settings saved')
  }

  return (
    <div className="grid gap-6">
      <PageHeader title="Settings" description={superAdmin ? 'Your account and platform-wide defaults.' : 'Your account and notifications.'} />
      <Card title="Profile" description="How you appear to other admins.">
        <div className="flex items-center gap-4">
          <Avatar user={{ ...user, name }} size={56} />
          <div className="text-sm text-navy-500">{user.email}</div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" htmlFor="set-name">
            <Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Title" htmlFor="set-title" optional>
            <Input id="set-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lead Photographer" />
          </Field>
        </div>
      </Card>
      <Card title="Notifications" description="Email updates about your events.">
        <Switch label="Upload finished" description="When a batch of photos has been analyzed." checked={notify.uploads} onChange={(v) => setNotify({ ...notify, uploads: v })} />
        <Switch label="Processing failures" description="When photos can’t be analyzed." checked={notify.failures} onChange={(v) => setNotify({ ...notify, failures: v })} />
        <Switch label="Weekly digest" description="Searches, downloads and visitors each Monday." checked={notify.digest} onChange={(v) => setNotify({ ...notify, digest: v })} />
      </Card>
      {superAdmin && (
        <Card title="Privacy defaults" description="Applied to new events. Event settings can be stricter, never looser.">
          <Field label="Delete guest selfies’ face data after" htmlFor="retention" hint="Search history older than this is removed automatically.">
            <Select id="retention" value={platform.retention} onChange={(e) => setPlatform({ ...platform, retention: e.target.value })}>
              <option value="0">Immediately after the search</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </Select>
          </Field>
          <Switch label="Require consent before first search" description="Guests confirm biometric consent once per event. Always on." checked disabled onChange={() => {}} />
          <Switch label="Allow guest downloads" checked={platform.downloads} onChange={(v) => setPlatform({ ...platform, downloads: v })} />
          <Switch label="Watermark downloads" description="Adds the event name to downloaded photos." checked={platform.watermark} onChange={(v) => setPlatform({ ...platform, watermark: v })} />
        </Card>
      )}
      <div className="flex justify-end">
        <Button size="lg" onClick={save} loading={saving}>
          Save settings
        </Button>
      </div>
    </div>
  )
}
