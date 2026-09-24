import { ArrowRight, CalendarCheck, CalendarDays, HardDrive, Images, Plus, ScanFace, ScanSearch, Sparkles, UserCog, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { AreaChart, BarList, Panel, StatCard, StatusStack } from '../../components/charts'
import { ActivityFeed, EventCover } from '../../components/console'
import Button from '../../components/ui/Button'
import { PageHeader, Progress, Skeleton, StatusBadge } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { compact, firstName, fmtDate, greeting, num } from '../../lib/utils'
import { platformOverview } from '../../services/analyticsService'

export function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-[118px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[320px] rounded-2xl lg:col-span-2" />
        <Skeleton className="h-[320px] rounded-2xl" />
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  useDocumentTitle('Overview')
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, loading } = useQuery(platformOverview, [])
  if (loading || !data) return <DashboardSkeleton />
  const t = data.totals
  const delta = t.searchesYesterday ? (t.searchesToday - t.searchesYesterday) / t.searchesYesterday : null

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`${greeting()}, ${firstName(user.name)}`}
        description={`${t.live} event${t.live === 1 ? ' is' : 's are'} live right now. Here’s how Genesis Hub is doing.`}
        actions={
          <Button to="/admin/events/create">
            <Plus /> Create event
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total events" value={num(t.events)} icon={CalendarDays} hint={`${t.active} active`} />
        <StatCard label="Active events" value={num(t.active)} icon={CalendarCheck} hint={`${t.live} live now`} />
        <StatCard label="Event admins" value={num(t.admins)} icon={UserCog} />
        <StatCard label="End users" value={num(t.users)} icon={Users} />
        <StatCard label="Photos uploaded" value={compact(t.photos)} icon={Images} hint={`${compact(t.faces)} faces indexed`} />
        <StatCard label="Face searches" value={compact(t.searches)} icon={ScanSearch} hint={`${Math.round(t.successRate * 100)}% found a match`} />
        <StatCard label="Photos discovered" value={compact(t.discovered)} icon={Sparkles} hint="by guests" />
        <StatCard label="Searches today" value={num(t.searchesToday)} icon={ScanFace} delta={delta} hint="vs yesterday" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Face searches" description="Last 30 days, all events" className="lg:col-span-2">
          <AreaChart data={data.searches} unit="Searches" label="Face searches per day, last 30 days" />
        </Panel>
        <Panel title="Event performance" description="Searches per event" action={<Link to="/admin/analytics" className="text-[13px] font-medium text-brand-700 hover:underline">Details</Link>}>
          <BarList items={data.topEvents} onSelect={(it) => navigate(`/admin/events/${it.id}`)} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Recent events"
          className="lg:col-span-2"
          action={
            <Link to="/admin/events" className="flex items-center gap-1 text-[13px] font-medium text-brand-700 hover:underline">
              All events <ArrowRight className="size-3.5" />
            </Link>
          }
        >
          <ul className="-mx-2 divide-y divide-navy-100">
            {data.recentEvents.map((ev) => (
              <li key={ev.id}>
                <Link to={`/admin/events/${ev.id}`} className="flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-navy-50/70">
                  <EventCover ev={ev} className="h-11 w-16 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy-900">{ev.name}</span>
                    <span className="block text-[13px] text-navy-500">
                      {fmtDate(ev.date)} · {ev.city}
                    </span>
                  </span>
                  <span className="hidden text-right text-[13px] text-navy-500 tabular-nums sm:block">
                    <span className="block font-medium text-navy-800">{compact(ev.stats.photos)} photos</span>
                    {compact(ev.stats.searches)} searches
                  </span>
                  <StatusBadge status={ev.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Recent activity">
          <ActivityFeed items={data.activity.slice(0, 6)} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Storage" description="Original photos across all events">
          <div className="flex items-end justify-between">
            <span className="text-3xl font-semibold tracking-tight text-navy-950 tabular-nums">
              {data.storage.usedGb.toFixed(1)} <span className="text-lg font-medium text-navy-400">GB</span>
            </span>
            <span className="text-sm text-navy-500">of {data.storage.quotaGb} GB</span>
          </div>
          <Progress value={data.storage.usedGb / data.storage.quotaGb} className="mt-4 h-2.5" />
          <p className="mt-3 flex items-center gap-2 text-[13px] text-navy-500">
            <HardDrive className="size-4" /> {Math.round((1 - data.storage.usedGb / data.storage.quotaGb) * 100)}% free · roughly {compact(Math.round(((data.storage.quotaGb - data.storage.usedGb) * 1000) / 6.1))} more photos
          </p>
        </Panel>
        <Panel title="Photo processing" description="Demo gallery photos by analysis status">
          <StatusStack counts={data.processing} />
        </Panel>
      </div>
    </div>
  )
}
