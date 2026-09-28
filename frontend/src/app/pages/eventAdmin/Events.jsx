import { CalendarRange } from 'lucide-react'
import { EmptyState, PageHeader, Skeleton } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { adminOverview } from '../../services/analyticsService'
import { listAdminEvents } from '../../services/eventService'
import { AssignedEventCard } from './Dashboard'

export default function EAEvents() {
  useDocumentTitle('My events')
  const { data: events, loading } = useQuery(() => listAdminEvents(), [])
  const { data: overview } = useQuery(() => adminOverview(30), [])
  return (
    <div className="grid gap-6">
      <PageHeader title="My events" description="Events a Super Admin has assigned to you. Your access is set per event." />
      {loading ? (
        [0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)
      ) : events.length ? (
        <div className="grid gap-4">
          {events.map((ev, i) => (
            <AssignedEventCard key={ev.id} ev={ev} stats={overview?.perEvent[ev.id]} i={i} />
          ))}
        </div>
      ) : (
        <EmptyState icon={CalendarRange} title="No events assigned yet" className="rounded-2xl border border-navy-100 bg-white">
          Ask your Super Admin to assign you to an event. It will appear here right away.
        </EmptyState>
      )}
    </div>
  )
}
