import { Archive, ArrowLeft, CalendarDays, Clock, Download, ExternalLink, Images, MapPin, Pencil, ScanFace, ScanSearch, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { AssignAdminsDrawer } from '../../components/AssignAdmins'
import { AreaChart, Panel, StatusStack } from '../../components/charts'
import { EventCover, StatStrip } from '../../components/console'
import Photo from '../../components/Photo'
import Button from '../../components/ui/Button'
import { Modal, useToast } from '../../components/ui/overlay'
import { Avatar, Badge, EmptyState, Skeleton, StatusBadge } from '../../components/ui/primitives'
import { PERMISSIONS } from '../../data/seed'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { compact, fmtDate, fmtTime, num } from '../../lib/utils'
import { eventAnalytics } from '../../services/analyticsService'
import { db } from '../../services/db'
import { archiveEvent, getEvent, listEventAssignments } from '../../services/eventService'

export function EventDetailSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-56 rounded-3xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}

export function EventBanner({ ev, back, actions }) {
  return (
    <div>
      <Link to={back.to} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-900">
        <ArrowLeft className="size-4" /> {back.label}
      </Link>
      <div className="relative overflow-hidden rounded-3xl bg-navy-950">
        <EventCover ev={ev} className="absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy-950 via-navy-950/80 to-navy-950/20" />
        <div className="relative flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={ev.status} onDark />
              <Badge tone="dark">{ev.type}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{ev.name}</h1>
            <p className="mt-1 text-white/70">{ev.subtitle}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/80">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4 text-cyan-300" /> {fmtDate(ev.date, { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-4 text-cyan-300" /> {fmtTime(ev.start)} – {fmtTime(ev.end)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4 text-cyan-300" /> {[ev.venue, ev.city].filter(Boolean).join(', ')}
              </span>
            </div>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  )
}

export default function AdminEventDetail() {
  const { eventId } = useParams()
  const toast = useToast()
  const { data: ev, loading, error } = useQuery(() => getEvent(eventId), [eventId])
  const { data: stats } = useQuery(() => eventAnalytics(eventId), [eventId])
  const { data: assignments } = useQuery(() => listEventAssignments(eventId), [eventId])
  const [assigning, setAssigning] = useState(false)
  const [archiving, setArchiving] = useState(false)
  useDocumentTitle(ev?.name)

  if (loading) return <EventDetailSkeleton />
  if (error) return <EmptyState icon={ScanSearch} title="Event not found" action={<Button to="/admin/events">All events</Button>} />

  const photos = db()
    .photos.filter((p) => p.eventId === eventId)
    .slice(0, 8)

  return (
    <div className="grid gap-6">
      <EventBanner
        ev={ev}
        back={{ to: '/admin/events', label: 'Events' }}
        actions={
          <>
            <Button variant="glass" to={`/admin/events/${ev.id}/edit`}>
              <Pencil /> Edit
            </Button>
            <Button variant="light" onClick={() => setAssigning(true)}>
              <UserPlus /> Assign admins
            </Button>
          </>
        }
      />

      <StatStrip
        items={[
          { label: 'Photos', value: compact(ev.stats.photos), icon: Images },
          { label: 'Faces detected', value: compact(ev.stats.faces), icon: ScanFace },
          { label: 'Searches', value: compact(ev.stats.searches), icon: ScanSearch },
          { label: 'Unique visitors', value: compact(ev.stats.visitors), icon: Users },
          { label: 'Downloads', value: compact(ev.stats.downloads), icon: Download },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Searches" description="Guest face searches for this event" className="lg:col-span-2">
          {stats?.searches.length ? (
            <AreaChart data={stats.searches} unit="Searches" height={200} />
          ) : (
            <EmptyState icon={ScanSearch} title="No searches yet" className="py-8">
              Searches appear here once guests start looking for their photos.
            </EmptyState>
          )}
        </Panel>

        <Panel
          title="Event admins"
          description="Event-level access"
          action={
            <Button size="sm" variant="secondary" to={`/admin/events/${ev.id}/admins`}>
              Manage
            </Button>
          }
        >
          {assignments?.length ? (
            <ul className="grid gap-3">
              {assignments.map((a) => {
                const u = db().users.find((x) => x.id === a.userId)
                const n = PERMISSIONS.filter((p) => a.perms[p.key]).length
                return (
                  <li key={a.userId} className="flex items-center gap-3">
                    <Avatar user={u} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy-900">{u?.name}</span>
                      <span className="block truncate text-[12px] text-navy-500">{u?.title}</span>
                    </span>
                    <Badge tone={n === 5 ? 'brand' : 'neutral'}>
                      <ShieldCheck className="size-3" /> {n === 5 ? 'Full access' : `${n}/5`}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-navy-200 p-5 text-center">
              <p className="text-sm font-medium text-navy-800">No event admins yet</p>
              <p className="mt-1 text-[13px] text-navy-500">Assign a photographer so they can upload photos.</p>
              <Button size="sm" className="mt-3" onClick={() => setAssigning(true)}>
                <UserPlus /> Assign admin
              </Button>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Gallery sample" description={`${num(ev.stats.photos)} photos in this event`} className="lg:col-span-2">
          {photos.length ? (
            <div className="grid grid-cols-4 gap-2">
              {photos.map((p) => (
                <Photo key={p.id} photo={p} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : (
            <EmptyState icon={Images} title="No photos uploaded" className="py-8">
              Once an event admin uploads photos, every face is detected and indexed automatically.
            </EmptyState>
          )}
        </Panel>
        <Panel title="Processing">
          {stats && <StatusStack counts={stats.processing} />}
          <dl className="mt-6 grid gap-2.5 border-t border-navy-100 pt-5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-navy-500">Organizer</dt>
              <dd className="text-right font-medium text-navy-900">{ev.organizer}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-navy-500">Contact</dt>
              <dd className="truncate text-right font-medium text-navy-900">{ev.contact || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-navy-500">Guest link</dt>
              <dd className="flex items-center gap-1 truncate font-mono text-[12px] text-brand-700">
                /e/{ev.slug} <ExternalLink className="size-3" />
              </dd>
            </div>
          </dl>
        </Panel>
      </div>

      {ev.status !== 'Archived' && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-navy-100 bg-white p-5">
          <div>
            <p className="font-medium text-navy-900">Archive this event</p>
            <p className="text-[13px] text-navy-500">Hides it from guests. Photos and analytics are kept.</p>
          </div>
          <Button variant="destructive-ghost" onClick={() => setArchiving(true)} className="ring-1 ring-red-200">
            <Archive /> Archive event
          </Button>
        </div>
      )}

      <AssignAdminsDrawer event={ev} open={assigning} onClose={() => setAssigning(false)} />
      <Modal
        open={archiving}
        onClose={() => setArchiving(false)}
        title={`Archive ${ev.name}?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setArchiving(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await archiveEvent(ev.id)
                setArchiving(false)
                toast(`${ev.name} archived`)
              }}
            >
              Archive
            </Button>
          </>
        }
      >
        <p className="text-navy-600">Guests will no longer be able to open or search this event.</p>
      </Modal>
    </div>
  )
}
