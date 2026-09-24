import { ArrowRight, CalendarRange, Images } from 'lucide-react'
import { Link, Navigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { EventCover } from '../../components/console'
import { EmptyState, PageHeader, Skeleton, StatusBadge } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { compact, fmtDate } from '../../lib/utils'
import { listAdminEvents } from '../../services/eventService'

// "Photos" in the sidebar: pick which assigned event to manage.
export default function PickEvent() {
  useDocumentTitle('Photos')
  const { user } = useAuth()
  const { data: events, loading } = useQuery(() => listAdminEvents(user.id), [user.id], { live: false })
  if (loading) return <Skeleton className="h-64 rounded-2xl" />
  if (events.length === 1) return <Navigate to={`/event-admin/events/${events[0].id}/photos`} replace />
  return (
    <div className="grid gap-6">
      <PageHeader title="Photos" description="Choose an event to upload and manage its photos." />
      {events.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((ev) => (
            <li key={ev.id}>
              <Link to={`/event-admin/events/${ev.id}/photos`} className="group flex items-center gap-4 rounded-2xl border border-navy-100 bg-white p-4 shadow-card transition-shadow hover:shadow-lift">
                <EventCover ev={ev} className="h-16 w-20 shrink-0 rounded-xl" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold text-navy-950">{ev.name}</span>
                    <StatusBadge status={ev.status} />
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-navy-500">
                    {fmtDate(ev.date)} · <Images className="size-3.5" /> {compact(ev.stats.photos)} photos
                  </span>
                </span>
                <ArrowRight className="size-4 text-navy-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={CalendarRange} title="No events assigned yet" className="rounded-2xl border border-navy-100 bg-white">
          Photos can be uploaded once a Super Admin assigns you to an event.
        </EmptyState>
      )}
    </div>
  )
}
