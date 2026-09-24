import { ArrowLeft, CalendarDays, Check, ImagePlus, MapPin, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import Photo from '../../components/Photo'
import Button from '../../components/ui/Button'
import { useToast } from '../../components/ui/overlay'
import { Field, Input, PageHeader, Select, Skeleton, StatusBadge, Textarea } from '../../components/ui/primitives'
import { pool } from '../../data/gallery'
import { EVENT_STATUSES, EVENT_TYPES } from '../../data/seed'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { cn, fmtDate, fmtTime } from '../../lib/utils'
import { createEvent, getEvent, slugify, updateEvent } from '../../services/eventService'

const EMPTY = {
  name: '',
  slug: '',
  type: 'Wedding',
  date: '',
  start: '18:00',
  end: '23:00',
  venue: '',
  city: '',
  description: '',
  cover: null,
  logo: null,
  organizer: '',
  contact: '',
  status: 'Draft',
}

const SAMPLE_COVERS = ['wedding', 'summit', 'collegefest', 'party', 'music', 'sports'].map((p) => pool(p).find((x) => x.width > x.height)?.src).filter(Boolean)

async function fileToDataUrl(file, max) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * s)
  c.height = Math.round(bmp.height * s)
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.8)
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
  const [slugTouched, setSlugTouched] = useState(false)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const coverInput = useRef(null)
  const logoInput = useRef(null)

  useEffect(() => {
    if (existing) {
      setForm({ ...EMPTY, ...existing })
      setSlugTouched(true)
    }
  }, [existing])

  const set = (k, v) => {
    setForm((f) => {
      const next = { ...f, [k]: v }
      if (k === 'name' && !slugTouched) next.slug = slugify(v)
      return next
    })
    setErrors((e) => ({ ...e, [k]: undefined }))
  }
  const bind = (k) => ({ value: form[k] ?? '', onChange: (e) => set(k, e.target.value), 'aria-invalid': !!errors[k], id: k })

  const validate = () => {
    const e = {}
    if (form.name.trim().length < 3) e.name = 'Give the event a name (3+ characters).'
    if (!/^[a-z0-9-]{3,}$/.test(form.slug)) e.slug = 'Use lowercase letters, numbers and dashes.'
    if (!form.date) e.date = 'Pick the event date.'
    if (form.start && form.end && form.end <= form.start && form.end !== '00:00') e.end = 'End time should be after the start.'
    if (!form.city.trim()) e.city = 'Where is it happening?'
    if (!form.organizer.trim()) e.organizer = 'Who is organizing it?'
    if (form.contact && !/^\S+@\S+\.\S+$|^[+\d][\d\s-]{6,}$/.test(form.contact)) e.contact = 'Enter an email or phone number.'
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
      const data = { ...form, subtitle: form.subtitle || form.type }
      delete data.admins
      delete data.sampleCount
      const ev = editing ? await updateEvent(eventId, data) : await createEvent(data)
      toast(editing ? 'Changes saved' : 'Event created', {
        description: editing ? undefined : 'Next, assign an event admin to start uploading photos.',
      })
      navigate(editing ? `/admin/events/${eventId}` : `/admin/events/${ev.id}/admins`)
    } catch (err) {
      setErrors({ slug: err.message })
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

  const preview = { ...form, cover: form.cover }

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
            <Field label="Event URL" htmlFor="slug" error={errors.slug} hint="Guests use this link to find the event.">
              <div className="flex overflow-hidden rounded-[10px] border border-navy-200 shadow-card focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15">
                <span className="flex items-center border-r border-navy-200 bg-navy-50 px-3 text-sm text-navy-500">genesishub.app/e/</span>
                <input
                  {...bind('slug')}
                  onChange={(e) => {
                    setSlugTouched(true)
                    set('slug', slugify(e.target.value))
                  }}
                  className="h-11 min-w-0 flex-1 px-3 text-[15px] outline-none"
                  placeholder="sarah-arjun-wedding"
                />
              </div>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Event type" htmlFor="type">
                <Select {...bind('type')}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status" htmlFor="status" hint={form.status === 'Live' ? 'Guests can search as soon as photos are uploaded.' : form.status === 'Draft' ? 'Only admins can see drafts.' : undefined}>
                <Select {...bind('status')}>
                  {EVENT_STATUSES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Description" htmlFor="description" optional>
              <Textarea {...bind('description')} placeholder="A short note guests see on the event page." />
            </Field>
          </Section>

          <Section title="Date & place">
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Date" htmlFor="date" error={errors.date}>
                <Input type="date" {...bind('date')} />
              </Field>
              <Field label="Start time" htmlFor="start">
                <Input type="time" {...bind('start')} />
              </Field>
              <Field label="End time" htmlFor="end" error={errors.end}>
                <Input type="time" {...bind('end')} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Venue" htmlFor="venue" optional>
                <Input {...bind('venue')} placeholder="The Taj Mahal Palace" />
              </Field>
              <Field label="City" htmlFor="city" error={errors.city}>
                <Input {...bind('city')} placeholder="Mumbai" icon={MapPin} />
              </Field>
            </div>
          </Section>

          <Section title="Branding" description="A great cover photo makes the event page feel like the event.">
            <div>
              <span className="text-sm font-medium text-navy-800">Cover image</span>
              <input
                ref={coverInput}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => e.target.files[0] && set('cover', await fileToDataUrl(e.target.files[0], 1400))}
              />
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-7">
                <button
                  type="button"
                  onClick={() => coverInput.current.click()}
                  className="grid aspect-[4/3] place-items-center rounded-lg border-2 border-dashed border-navy-200 text-navy-500 hover:border-brand-400 hover:text-brand-700"
                  aria-label="Upload cover image"
                >
                  <Upload className="size-5" />
                </button>
                {[...(form.cover && !SAMPLE_COVERS.includes(form.cover) ? [form.cover] : []), ...SAMPLE_COVERS].map((src) => (
                  <button
                    type="button"
                    key={src.slice(0, 80)}
                    onClick={() => set('cover', src)}
                    className={cn('relative aspect-[4/3] overflow-hidden rounded-lg ring-2 transition', form.cover === src ? 'ring-brand-600' : 'ring-transparent hover:ring-navy-200')}
                    aria-label="Use this cover"
                    aria-pressed={form.cover === src}
                  >
                    <img src={src} alt="" className="size-full object-cover" />
                    {form.cover === src && (
                      <span className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input ref={logoInput} type="file" accept="image/*" hidden onChange={async (e) => e.target.files[0] && set('logo', await fileToDataUrl(e.target.files[0], 256))} />
              <span className="grid size-16 place-items-center overflow-hidden rounded-xl border border-navy-200 bg-navy-50 text-navy-400">
                {form.logo ? <img src={form.logo} alt="Event logo" className="size-full object-cover" /> : <ImagePlus className="size-5" />}
              </span>
              <div>
                <p className="text-sm font-medium text-navy-800">Event logo</p>
                <p className="text-[13px] text-navy-500">Square PNG or JPG. Shown on the guest event page.</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => logoInput.current.click()}>
                    {form.logo ? 'Replace' : 'Upload logo'}
                  </Button>
                  {form.logo && (
                    <Button size="sm" variant="ghost" onClick={() => set('logo', null)}>
                      <X /> Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Organizer">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Organizer name" htmlFor="organizer" error={errors.organizer}>
                <Input {...bind('organizer')} placeholder="Kapoor & Co. Weddings" />
              </Field>
              <Field label="Organizer contact" htmlFor="contact" error={errors.contact} optional>
                <Input {...bind('contact')} placeholder="hello@example.com" />
              </Field>
            </div>
          </Section>
        </div>

        {/* live preview */}
        <aside className="grid gap-4 lg:sticky lg:top-8">
          <p className="text-[13px] font-medium text-navy-500">Guest preview</p>
          <div className="overflow-hidden rounded-3xl bg-white shadow-lift ring-1 ring-navy-100">
            <div className="relative aspect-[16/10] bg-gradient-to-br from-navy-800 to-brand-800">
              {preview.cover && <Photo photo={{ src: preview.cover }} className="absolute inset-0" />}
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 to-transparent" />
              <StatusBadge status={form.status} onDark className="absolute top-3 left-3" />
              {form.logo && <img src={form.logo} alt="" className="absolute top-3 right-3 size-10 rounded-lg object-cover ring-2 ring-white" />}
            </div>
            <div className="p-5">
              <h3 className="text-lg font-semibold text-navy-950">{form.name || 'Your event name'}</h3>
              <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-navy-500">
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-3.5" /> {form.date ? fmtDate(form.date) : 'Date'}
                  {form.start && ` · ${fmtTime(form.start)}`}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" /> {form.city || 'City'}
                </span>
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
