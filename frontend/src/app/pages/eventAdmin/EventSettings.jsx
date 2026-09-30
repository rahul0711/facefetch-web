import { ImagePlus, Lock, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { EventCover } from '../../components/console'
import EventDangerZone from '../../components/EventDangerZone'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/overlay'
import { Field, Input, Select, Textarea } from '../../components/ui/primitives'
import { useDocumentTitle } from '../../lib/hooks'
import { EVENT_STATUSES } from '../../services/adapters'
import { deleteCover, updateEvent, uploadCover } from '../../services/eventService'
import { EventAdminHeader, EventHeaderSkeleton, NotAssigned, useAdminEvent } from './shared'

const STATUS_HINT = {
  Draft: 'Hidden from guests while you upload.',
  Active: 'Guests can open the event and search.',
  Completed: 'Still searchable; marked as finished.',
  Archived: 'Hidden from guests.',
}

export default function EAEventSettings() {
  const { ev, perms, loading, error, reload } = useAdminEvent()
  useDocumentTitle(ev ? `Settings · ${ev.name}` : 'Settings')
  const toast = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [coverBusy, setCoverBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (ev && !form) setForm({ name: ev.name, description: ev.description, date: ev.date || '', location: ev.location, status: ev.status })
  }, [ev, form])

  if (loading) return <EventHeaderSkeleton />
  if (error || !ev) return <NotAssigned />
  if (!form) return <EventHeaderSkeleton />
  const can = perms.canManage
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    if (form.name.trim().length < 2) return setErr('Give the event a name.')
    setErr('')
    setSaving(true)
    try {
      await updateEvent(ev.eventId, form)
      toast('Event settings saved')
      reload()
    } catch (e) {
      setErr(e.message)
    } finally {
      setSaving(false)
    }
  }

  const changeCover = async (file) => {
    if (!file) return
    setCoverBusy(true)
    try {
      await uploadCover(ev.eventId, file)
      toast('Cover updated')
      reload()
    } catch (e) {
      toast(e.message, { tone: 'error' })
    } finally {
      setCoverBusy(false)
    }
  }

  return (
    <div className="grid gap-6">
      <EventAdminHeader ev={ev} perms={perms} />
      {!can && (
        <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <p>You can view these settings but not change them. Ask a Super Admin for “Manage event” access.</p>
        </div>
      )}
      <fieldset disabled={!can} className="grid gap-6 disabled:opacity-75">
        <section className="grid gap-5 rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-semibold text-navy-950">Event details</h2>
          <Field label="Event name" htmlFor="st-name">
            <Input id="st-name" value={form.name} onChange={set('name')} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Date" htmlFor="st-date" optional>
              <Input id="st-date" type="date" value={form.date} onChange={set('date')} />
            </Field>
            <Field label="Location" htmlFor="st-loc" optional>
              <Input id="st-loc" value={form.location} onChange={set('location')} />
            </Field>
          </div>
          <Field label="Description" htmlFor="st-desc" optional>
            <Textarea id="st-desc" value={form.description} onChange={set('description')} />
          </Field>
          <Field label="Status" htmlFor="st-status" hint={STATUS_HINT[form.status]}>
            <Select id="st-status" value={form.status} onChange={set('status')}>
              {EVENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </section>
        <section className="grid gap-4 rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:p-6">
          <h2 className="font-semibold text-navy-950">Cover image</h2>
          <div className="flex flex-wrap items-center gap-4">
            <EventCover ev={ev} className="h-24 w-40 rounded-xl" />
            <div className="flex gap-2">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => changeCover(e.target.files?.[0])} />
              <Button variant="secondary" loading={coverBusy} onClick={() => fileRef.current?.click()}>
                <ImagePlus /> {ev.cover ? 'Replace' : 'Upload'}
              </Button>
              {ev.cover && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    await deleteCover(ev.eventId)
                    reload()
                  }}
                >
                  <Trash2 /> Remove
                </Button>
              )}
            </div>
          </div>
        </section>
      </fieldset>
      {can && (
        <div className="flex items-center justify-end gap-4">
          {err && <p className="text-sm text-bad">{err}</p>}
          <Button size="lg" loading={saving} onClick={save}>
            Save settings
          </Button>
        </div>
      )}
      {/* only the event admin who created an event may delete it (a Super Admin can delete any) */}
      <EventDangerZone
        ev={ev}
        canManage={can}
        canDelete={can && ev.createdBy === user.id}
        onChanged={() => (setForm(null), reload())}
        onDeleted={() => navigate('/event-admin/events', { replace: true })}
      />
    </div>
  )
}
