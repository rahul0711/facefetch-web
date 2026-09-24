import { Download, Images, ScanFace, ScanSearch, Users } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { AreaChart, BarList, Panel, StatCard, StatusStack } from '../../components/charts'
import { PageHeader } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { compact } from '../../lib/utils'
import { adminOverview } from '../../services/analyticsService'
import { DashboardSkeleton } from '../admin/Dashboard'

// Aggregate analytics across the admin's assigned events only.
export default function EAAnalytics() {
  useDocumentTitle('Analytics')
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading } = useQuery(() => adminOverview(user.id), [user.id])
  if (loading || !data) return <DashboardSkeleton />
  const t = data.totals
  return (
    <div className="grid gap-6">
      <PageHeader title="Analytics" description={`Across your ${t.events} assigned event${t.events === 1 ? '' : 's'}.`} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="Photos" value={compact(t.photos)} icon={Images} />
        <StatCard label="Faces detected" value={compact(t.faces)} icon={ScanFace} />
        <StatCard label="Searches" value={compact(t.searches)} icon={ScanSearch} />
        <StatCard label="Unique visitors" value={compact(t.visitors)} icon={Users} />
        <StatCard label="Downloads" value={compact(t.downloads)} icon={Download} className="max-lg:col-span-2" />
      </div>
      <Panel title="Searches over time" description="Last 30 days">
        <AreaChart data={data.searches} unit="Searches" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Searches by event">
          <BarList items={data.topEvents} onSelect={(it) => navigate(`/event-admin/events/${it.id}/analytics`)} />
        </Panel>
        <Panel title="Photo processing status">
          <StatusStack counts={data.processing} />
        </Panel>
      </div>
    </div>
  )
}
