import { CircleCheck, Download, Images, ScanFace, ScanSearch, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { AreaChart, BarChart, BarList, Panel, StatCard, StatusStack } from '../../components/charts'
import { PageHeader, Segmented } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { compact, pct } from '../../lib/utils'
import { platformOverview } from '../../services/analyticsService'
import { DashboardSkeleton } from './Dashboard'

export default function AdminAnalytics() {
  useDocumentTitle('Analytics')
  const navigate = useNavigate()
  const [range, setRange] = useState('30')
  const { data } = useQuery(() => platformOverview(Number(range)), [range])
  if (!data) return <DashboardSkeleton />
  const t = data.totals
  const n = Number(range)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Analytics"
        description="How guests find their photos across every event."
        actions={<Segmented label="Date range" size="sm" value={range} onChange={setRange} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }]} />}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total photos" value={compact(t.photos)} icon={Images} />
        <StatCard label="Faces detected" value={compact(t.faces)} icon={ScanFace} />
        <StatCard label="Searches" value={compact(t.searches)} icon={ScanSearch} />
        <StatCard label="Successful searches" value={pct(t.successRate)} icon={CircleCheck} hint="found ≥1 photo" />
        <StatCard label="Downloads" value={compact(t.downloads)} icon={Download} />
        <StatCard label="Unique visitors" value={compact(t.visitors)} icon={Users} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Searches over time" description={`Daily face searches, last ${n} days`}>
          <AreaChart data={data.searches} unit="Searches" />
        </Panel>
        <Panel title="Uploads over time" description={`Photos uploaded per day, last ${n} days`}>
          <BarChart data={data.uploads} unit="Photos" height={220} />
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Popular events" description="By total face searches">
          <BarList items={data.topEvents} onSelect={(it) => navigate(`/admin/events/${it.id}`)} />
        </Panel>
        <Panel title="Photo processing status" description="Face-analysis state of all photos">
          <StatusStack counts={data.processing} />
          <p className="mt-6 rounded-xl bg-navy-50 p-4 text-[13px] leading-relaxed text-navy-600">
            Failed photos are usually too blurry or dark to find faces in. Event admins can re-analyze them from the photo manager.
          </p>
        </Panel>
      </div>
    </div>
  )
}
