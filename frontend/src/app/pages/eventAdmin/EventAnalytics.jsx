import { BarChart3, CircleCheck, Download, Images, ScanFace, ScanSearch, Users } from 'lucide-react'
import { AreaChart, BarChart, Panel, StatCard, StatusStack } from '../../components/charts'
import { EmptyState, Skeleton } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { compact } from '../../lib/utils'
import { eventAnalytics } from '../../services/analyticsService'
import { EventAdminHeader, EventHeaderSkeleton, Locked, NotAssigned, useAdminEvent } from './shared'

export default function EAEventAnalytics() {
  const { ev, perms, loading, error, eventId } = useAdminEvent()
  useDocumentTitle(ev ? `Analytics · ${ev.name}` : 'Analytics')
  const { data } = useQuery(() => eventAnalytics(eventId), [eventId])
  if (loading) return <EventHeaderSkeleton />
  if (error) return <NotAssigned />

  return (
    <div className="grid gap-6">
      <EventAdminHeader ev={ev} perms={perms} />
      {!perms.analytics ? (
        <Locked what="view analytics" />
      ) : !data ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : !data.totals.searches && !data.totals.photos ? (
        <EmptyState icon={BarChart3} title="No analytics yet" className="rounded-2xl border border-navy-100 bg-white">
          Numbers appear once photos are uploaded and guests start searching.
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total photos" value={compact(data.totals.photos)} icon={Images} />
            <StatCard label="Faces detected" value={compact(data.totals.faces)} icon={ScanFace} />
            <StatCard label="Searches" value={compact(data.totals.searches)} icon={ScanSearch} />
            <StatCard label="Successful" value={compact(data.totals.successful)} icon={CircleCheck} hint="found photos" />
            <StatCard label="Downloads" value={compact(data.totals.downloads)} icon={Download} />
            <StatCard label="Unique visitors" value={compact(data.totals.visitors)} icon={Users} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Searches over time">
              {data.searches.length ? <AreaChart data={data.searches} unit="Searches" /> : <p className="py-10 text-center text-sm text-navy-400">No searches yet.</p>}
            </Panel>
            <Panel title="Uploads over time">
              {data.uploads.length ? <BarChart data={data.uploads} unit="Photos" height={220} /> : <p className="py-10 text-center text-sm text-navy-400">No uploads yet.</p>}
            </Panel>
          </div>
          <Panel title="Photo processing status">
            <StatusStack counts={data.processing} />
          </Panel>
        </>
      )}
    </div>
  )
}
