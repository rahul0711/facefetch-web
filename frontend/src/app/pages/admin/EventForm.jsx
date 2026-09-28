import { ArrowLeft, CalendarDays, Hash, MapPin, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Photo from '../../components/Photo'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/overlay'
import { Field, Input, PageHeader, Select, Skeleton, StatusBadge, Textarea } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { fmtDate } from '../../lib/utils'
import { EVENT_STATUSES } from '../../services/adapters'
import { createEvent, getEvent, slugify, updateEvent, uploadCover } from '../../services/eventService'

const EMPTY = { name: '', code: '', date: '', location: '', description: '', status: 'Draft' }

const STATUS_HINT = {
  Draft: 'Only admins can see drafts. Upload photos first, then make it Active.',
  Active: 'Guests can open the event and search for their photos.',
  Completed: 'Still searchable by guests; marked as finished.',
  Archived: 'Hidden from guests. Photos and analytics are kept.',
}

function Section({ title, description, children }) {
  return (
    <section className="grid gap-5 rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:p-6">
      <div>
        <h2 className="font-semibold text-navy-950">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-navy-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}

export default function EventForm() {
  const { eventId } = useParams()
  const editing = !!eventId
  useDocumentTitle(editing ? 'Edit event' : 'Create event')
  const navigate = useNavigate()
  const toast = useToast()
  const { data: existing, loading } = useQuery(() => (editing ? getEvent(eventId) : Promise.resolve(null)), [eventId], { live: false })
  const [form, setForm] = useState(EMPTY)
  const [codeTouched, setCodeTouched] = useState(false)
  const [cover, setCover] = useState(null) // { file, url } picked locally
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const coverInput = useRef(null)

  useEffect(() => {
    if (existing) {
      setForm({ name: existing.name, code: existing.code, date: existing.date || '', location: existing.location, description: existing.description, status: existing.status })
      setCodeTouched(true)
    }
  }, [existing])

  useEffect(() => () => cover && URL.revokeObjectURL(cover.url), [cover])

  const set = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v }
      if (k === 'name' && !codeTouched) next.code = slugify(v)
      return next
    })
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const bind = (k) => ({ value: form[k] ?? '', onChange: (e) => set(k, e.target.value), 'aria-invalid': !!errors[k], id: k })

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 3) e.name = 'Give the event a name (3+ characters).'
    if (!editing && !/^[a-zA-Z0-9-]{3,100}$/.test(form.code)) e.code = 'Use 3+ letters, numbers and dashes.'
    setErrors(e)
    return !Object.keys(e).length
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!validate()) {
      document.querySelector('[aria-invalid="true"]')?.focus()
      return
    }
    setSaving(true)
    try {
      const ev = editing ? await updateEvent(eventId, form) : await createEvent(form)
      if (cover) {
        try {
          await uploadCover(ev.eventId, cover.file)
        } catch (err) {
          toast('Event saved, but the cover didn’t upload', { tone: 'error', description: err.message })
        }
      }
      toast(editing ? 'Changes saved' : 'Event created', {
        description: editing ? undefined : 'Next, assign an event admin to start uploading photos.',
      })
      navigate(editing ? `/admin/events/${eventId}` : `/admin/events/${ev.id}/admins`)
    } catch (err) {
      setErrors({ [/code/i.test(err.message) ? 'code' : 'name']: err.message })
      setSaving(false)
    }
  }

  if (editing && loading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  const previewCover = cover?.url || existing?.cover

  return (
    <form onSubmit={submit} noValidate className="grid gap-6">
      <Link to={editing ? `/admin/events/${eventId}` : '/admin/events'} className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-900">
        <ArrowLeft className="size-4" /> {editing ? 'Back to event' : 'Events'}
      </Link>
      <PageHeader
        title={editing ? `Edit ${existing?.name}` : 'Create event'}
        description={editing ? 'Changes are visible to guests immediately.' : 'Set up the event. You can assign admins and upload photos next.'}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid gap-6">
          <Section title="Basics">
            <Field label="Event name" htmlFor="name" error={errors.name}>
              <Input {...bind('name')} placeholder="Sarah & Arjun Wedding" />
            </Field>
            <Field label="Event code" htmlFor="code" error={errors.code} hint={editing ? 'The code can’t be changed after the event is created.' : 'A unique short code for this event.'}>
              <Input
                {...bind('code')}
                icon={Hash}
                disabled={editing}
                onChange={(e) => {
                  setCodeTouched(true)
                  set('code', slugify(e.target.value))
                }}
                placeholder="sarah-arjun-wedding"
              />
            </Field>
            <Field label="Status" htmlFor="status" hint={STATUS_HINT[form.status]}>
              <Select {...bind('status')}>
                {EVENT_STATUSES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Description" htmlFor="description" optional>
              <Textarea {...bind('description')} placeholder="A short note guests see on the event page." />
            </Field>
          </Section>

          <Section title="Date & place">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Date" htmlFor="date" optional>
                <Input type="date" {...bind('date')} />
              </Field>
              <Field label="Location" htmlFor="location" optional>
                <Input {...bind('location')} placeholder="The Taj Mahal Palace, Mumbai" icon={MapPin} />
              </Field>
            </div>
          </Section>

          <Section title="Cover image" description="A great cover photo makes the event page feel like the event.">
            <input
              ref={coverInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setCover({ file: f, url: URL.createObjectURL(f) })
                e.target.value = ''
              }}
            />
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => coverInput.current.click()}
                className="relative grid aspect-[16/10] w-48 place-items-center overflow-hidden rounded-xl border-2 border-dashed border-navy-200 text-navy-500 hover:border-brand-400 hover:text-brand-700"
                aria-label="Choose cover image"
              >
                {previewCover ? <img src={previewCover} alt="" className="absolute inset-0 size-full object-cover" /> : <Upload className="size-6" />}
              </button>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => coverInput.current.click()}>
                  {previewCover ? 'Replace' : 'Upload cover'}
                </Button>
                {cover && (
                  <Button size="sm" variant="ghost" onClick={() => setCover(null)}>
                    <X /> Undo
                  </Button>
                )}
              </div>
            </div>
          </Section>
        </div>

        {/* live preview */}
        <aside className="grid gap-4 lg:sticky lg:top-8">
          <p className="text-[13px] font-medium text-navy-500">Guest preview</p>
          <div className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-navy-100">
            <div className="relative aspect-[16/10] bg-gradient-to-br from-navy-800 to-brand-800">
              {previewCover && <Photo photo={{ src: previewCover }} className="absolute inset-0" />}
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 to-transparent" />
              <StatusBadge status={form.status} onDark className="absolute top-3 left-3" />
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-navy-950">{form.name || 'Your event name'}</h3>
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-navy-500">
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" /> {form.date ? fmtDate(form.date) : 'Date'}
                </span>
                {form.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" /> {form.location}
                  </span>
                )}
              </p>
              <span className="mt-4 flex h-10 items-center justify-center rounded-[10px] bg-brand-600 text-sm font-medium text-white">Find My Photos</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="lg" loading={saving} className="flex-1">
              {editing ? 'Save changes' : 'Create event'}
            </Button>
            <Button variant="secondary" size="lg" to={editing ? `/admin/events/${eventId}` : '/admin/events'}>
              Cancel
            </Button>
          </div>
        </aside>
      </div>
    </form>
  )
}
