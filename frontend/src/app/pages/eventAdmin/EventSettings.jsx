import { Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/overlay'
import { Field, Input, Select, Switch, Textarea } from '../../components/ui/primitives'
import { useDocumentTitle } from '../../lib/hooks'
import { updateEvent } from '../../services/eventService'
import { EventAdminHeader, EventHeaderSkeleton, NotAssigned, useAdminEvent } from './shared'

export default function EAEventSettings() {
  const { ev, perms, loading, error } = useAdminEvent()
  useDocumentTitle(ev ? `Settings · ${ev.name}` : 'Settings')
  const toast = useToast()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (ev && !form)
      setForm({
        subtitle: ev.subtitle || '',
        description: ev.description || '',
        venue: ev.venue || '',
        search: ev.guestSearch ?? true,
        downloads: ev.allowDownloads ?? true,
        watermark: ev.watermark ?? false,
        visibility: ev.visibility || 'invite',
      })
  }, [ev, form])

  if (loading || !form) return <EventHeaderSkeleton />
  if (error) return <NotAssigned />
  const can = perms.settings
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }))

  return (
    <div className="grid gap-6">
      <EventAdminHeader ev={ev} perms={perms} />
      {!can && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>You can view these settings but not change them. Ask a Super Admin for “Manage event settings” access.</p>
        </div>
      )}
      <fieldset disabled={!can} className="grid gap-6 disabled:opacity-75">
        <section className="grid gap-5 rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-semibold text-navy-950">Event page</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Subtitle" htmlFor="st-sub">
              <Input id="st-sub" value={form.subtitle} onChange={set('subtitle')} />
            </Field>
            <Field label="Venue" htmlFor="st-venue">
              <Input id="st-venue" value={form.venue} onChange={set('venue')} />
            </Field>
          </div>
          <Field label="Description" htmlFor="st-desc">
            <Textarea id="st-desc" value={form.description} onChange={set('description')} />
          </Field>
        </section>
        <section className="grid gap-5 rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-semibold text-navy-950">Guest access & privacy</h2>
          <Field label="Who can open this event" htmlFor="st-vis">
            <Select id="st-vis" value={form.visibility} onChange={set('visibility')}>
              <option value="invite">Invited guests only</option>
              <option value="link">Anyone with the event link</option>
            </Select>
          </Field>
          <Switch label="Guest face search" description="Let guests find their photos with a selfie." checked={form.search} onChange={set('search')} disabled={!can} />
          <Switch label="Allow downloads" description="Guests can save full-quality photos they appear in." checked={form.downloads} onChange={set('downloads')} disabled={!can} />
          <Switch label="Watermark downloads" description="Adds the event name to the corner of downloaded photos." checked={form.watermark} onChange={set('watermark')} disabled={!can} />
        </section>
      </fieldset>
      {can && (
        <div className="flex justify-end">
          <Button
            size="lg"
            loading={saving}
            onClick={async () => {
              setSaving(true)
              await updateEvent(ev.id, {
                subtitle: form.subtitle,
                description: form.description,
                venue: form.venue,
                guestSearch: form.search,
                allowDownloads: form.downloads,
                watermark: form.watermark,
                visibility: form.visibility,
              })
              setSaving(false)
              toast('Event settings saved')
            }}
          >
            Save settings
          </Button>
        </div>
      )}
    </div>
  )
}
