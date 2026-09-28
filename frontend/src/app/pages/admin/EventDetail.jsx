import { Archive, ArrowLeft, CalendarDays, Copy, Download, Hash, Images, MapPin, Pencil, ScanFace, ScanSearch, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { AssignAdminsDrawer } from '../../components/AssignAdmins'
import { AreaChart, Panel, StatusStack } from '../../components/charts'
import { EventCover, StatStrip } from '../../components/console'
import Photo from '../../components/Photo'
import Button from '../../components/ui/Button'
import { Modal, useToast } from '../../components/ui/overlay'
import { Avatar, Badge, EmptyState, Skeleton, StatusBadge } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { compact, copyText, fmtDate, num } from '../../lib/utils'
import { PERMISSIONS } from '../../services/adapters'
import { eventAnalytics } from '../../services/analyticsService'
import { listPhotos } from '../../services/photoService'
import { shareLink } from '../../services/searchService'
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
              <Badge tone="dark">
                <Hash className="size-3" /> {ev.code}
              </Badge>
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{ev.name}</h1>
            {ev.description && <p className="mt-1 line-clamp-2 max-w-2xl text-white/70">{ev.description}</p>}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/80">
              {ev.date && (
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-4 text-cyan-300" /> {fmtDate(ev.date, { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
              {ev.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-cyan-300" /> {ev.location}
                </span>
              )}
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
  const { data: stats } = useQuery(() => eventAnalytics(eventId, 30), [eventId])
  const { data: photos } = useQuery(() => listPhotos(eventId, { pageSize: 8 }).then((r) => r.items), [eventId])
  const { data: assignments } = useQuery(() => listEventAssignments(eventId), [eventId])
  const [assigning, setAssigning] = useState(false)
  const [archiving, setArchiving] = useState(false)
  useDocumentTitle(ev?.name)

  if (loading) return <EventDetailSkeleton />
  if (error || !ev) return <EmptyState icon={ScanSearch} title="Event not found" action={<Button to="/admin/events">All events</Button>} />

  const st = stats?.stats || {}

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
          { label: 'Photos', value: compact(st.photos ?? ev.photoCount), icon: Images },
          { label: 'Faces detected', value: compact(st.faces ?? 0), icon: ScanFace },
          { label: 'Searches', value: compact(st.searches ?? 0), icon: ScanSearch },
          { label: 'Unique visitors', value: compact(st.uniqueVisitors ?? 0), icon: Users },
          { label: 'Downloads', value: compact(st.downloads ?? 0), icon: Download },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Searches" description="Guest face searches for this event" className="lg:col-span-2">
          {stats?.searches.some((d) => d.value) ? (
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
                const n = PERMISSIONS.filter((p) => a.perms[p.key]).length
                return (
                  <li key={a.userId} className="flex items-center gap-3">
                    <Avatar user={a} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-navy-900">{a.name}</span>
                      <span className="block truncate text-[12px] text-navy-500">{a.email}</span>
                    </span>
                    <Badge tone={n === PERMISSIONS.length ? 'brand' : 'neutral'}>
                      <ShieldCheck className="size-3" /> {n === PERMISSIONS.length ? 'Full access' : PERMISSIONS.filter((p) => a.perms[p.key]).map((p) => p.short).join(' · ')}
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
        <Panel title="Gallery sample" description={`${num(st.photos ?? ev.photoCount)} photos in this event`} className="lg:col-span-2">
          {photos?.length ? (
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
              <dt className="text-navy-500">Created by</dt>
              <dd className="text-right font-medium text-navy-900">{ev.createdByName || '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-navy-500">Storage</dt>
              <dd className="text-right font-medium text-navy-900">{st.storageBytes != null ? `${(st.storageBytes / 1048576).toFixed(1)} MB` : '—'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-navy-500">Guest link</dt>
              <dd>
                <button
                  onClick={async () => {
                    await copyText(shareLink(ev))
                    toast('Guest link copied')
                  }}
                  className="flex items-center gap-1 font-mono text-[12px] text-brand-700 hover:underline"
                >
                  /events/{ev.id} <Copy className="size-3" />
                </button>
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
                try {
                  await archiveEvent(ev.eventId)
                  toast(`${ev.name} archived`)
                } catch (e) {
                  toast(e.message, { tone: 'error' })
                }
                setArchiving(false)
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
