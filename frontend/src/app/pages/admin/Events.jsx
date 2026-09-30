import { CalendarPlus, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { AssignAdminsDrawer } from '../../components/AssignAdmins'
import { AdminEventCard, CardGridSkeleton } from '../../components/console'
import { EventActionDialog } from '../../components/EventDangerZone'
import Button from '../../components/ui/Button'
import { EmptyState, Input, PageHeader, Segmented } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { EVENT_STATUSES } from '../../services/adapters'
import { listEvents } from '../../services/eventService'

export default function AdminEvents() {
  useDocumentTitle('Events')
  const navigate = useNavigate()
  const { data: events, loading } = useQuery(() => listEvents(), [])
  const [status, setStatus] = useState('All')
  const [q, setQ] = useState('')
  const [assigning, setAssigning] = useState(null)
  const [acting, setActing] = useState(null) // { ev, action }

  const counts = useMemo(() => {
    const c = { All: events?.length || 0 }
    EVENT_STATUSES.forEach((s) => (c[s] = events?.filter((e) => e.status === s).length || 0))
    return c
  }, [events])

  const shown = (events || []).filter(
    (e) => (status === 'All' || e.status === status) && `${e.name} ${e.code} ${e.location}`.toLowerCase().includes(q.toLowerCase()),
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Events"
        description="Create events, assign their admins, and keep an eye on how guests use them."
        actions={
          <Button to="/admin/events/create">
            <Plus /> Create event
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="scrollbar-none -my-1 max-w-full overflow-x-auto py-1">
          <Segmented label="Filter by status" size="sm" value={status} onChange={setStatus} options={['All', ...EVENT_STATUSES].map((s) => ({ value: s, label: s, count: counts[s] }))} />
        </div>
        <div className="ml-auto w-full sm:w-64">
          <Input icon={Search} placeholder="Search events" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" className="h-10" />
        </div>
      </div>

      {loading ? (
        <CardGridSkeleton />
      ) : shown.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((ev, i) => (
            <AdminEventCard
              key={ev.id}
              ev={ev}
              i={i}
              to={`/admin/events/${ev.id}`}
              onEdit={(mode) => navigate(mode === 'edit' ? `/admin/events/${ev.id}/edit` : `/admin/events/${ev.id}`)}
              onAssign={() => setAssigning(ev)}
              onAction={(action) => setActing({ ev, action })}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarPlus}
          title={events?.length ? 'No events match' : 'No events yet'}
          className="rounded-2xl border border-dashed border-navy-200 bg-white"
          action={
            events?.length ? (
              <Button variant="secondary" onClick={() => (setQ(''), setStatus('All'))}>
                Clear filters
              </Button>
            ) : (
              <Button to="/admin/events/create">
                <Plus /> Create your first event
              </Button>
            )
          }
        >
          {events?.length ? 'Try a different status or search term.' : 'Create an event, assign a photographer, and guests can start finding their photos.'}
        </EmptyState>
      )}

      <AssignAdminsDrawer event={assigning} open={!!assigning} onClose={() => setAssigning(null)} />
      <EventActionDialog ev={acting?.ev} action={acting?.action} onClose={() => setActing(null)} onDone={() => setActing(null)} />
    </div>
  )
}
