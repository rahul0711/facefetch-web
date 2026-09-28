import { ArrowRight, CalendarCheck, CalendarDays, Download, HardDrive, Images, Plus, ScanFace, ScanSearch, UserCog, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { AreaChart, BarList, Panel, StatCard, StatusStack } from '../../components/charts'
import { ActivityFeed, EventCover } from '../../components/console'
import Button from '../../components/ui/Button'
import { EmptyState, PageHeader, Skeleton, StatusBadge } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { compact, fileSize, firstName, fmtDate, greeting, num } from '../../lib/utils'
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
  const { data, loading } = useQuery(() => platformOverview(30), [])
  if (loading || !data) return <DashboardSkeleton />
  const t = data.totals
  const delta = t.searchesYesterday ? (t.searchesToday - t.searchesYesterday) / t.searchesYesterday : null

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`${greeting()}, ${firstName(user.name)}`}
        description={`${t.active} event${t.active === 1 ? ' is' : 's are'} live right now. Here’s how Genesis Hub is doing.`}
        actions={
          <Button to="/admin/events/create">
            <Plus /> Create event
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total events" value={num(t.events)} icon={CalendarDays} hint={`${t.active} active`} />
        <StatCard label="Active events" value={num(t.active)} icon={CalendarCheck} hint="open to guests" />
        <StatCard label="Event admins" value={num(t.admins)} icon={UserCog} />
        <StatCard label="Guests" value={num(t.guests)} icon={Users} hint={`${num(t.visitors)} have searched`} />
        <StatCard label="Photos uploaded" value={compact(t.photos)} icon={Images} hint={`${compact(t.faces)} faces indexed`} />
        <StatCard label="Face searches" value={compact(t.searches)} icon={ScanSearch} hint={`${Math.round(t.successRate * 100)}% found a match`} />
        <StatCard label="Downloads" value={compact(t.downloads)} icon={Download} hint="by guests" />
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
          {!data.recentEvents.length && (
            <EmptyState icon={CalendarDays} title="No events yet" className="py-8" action={<Button to="/admin/events/create"><Plus /> Create event</Button>}>
              Create your first event, then assign an event admin to upload its photos.
            </EmptyState>
          )}
          <ul className="-mx-2 divide-y divide-navy-100">
            {data.recentEvents.map((ev) => (
              <li key={ev.id}>
                <Link to={`/admin/events/${ev.id}`} className="flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-navy-50/70">
                  <EventCover ev={ev} className="h-11 w-16 shrink-0 rounded-lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy-900">{ev.name}</span>
                    <span className="block text-[13px] text-navy-500">{[ev.date && fmtDate(ev.date), ev.location].filter(Boolean).join(' · ') || ev.code}</span>
                  </span>
                  <span className="hidden text-right text-[13px] text-navy-500 tabular-nums sm:block">
                    <span className="block font-medium text-navy-800">{compact(ev.photoCount)} photos</span>
                    {ev.createdByName && <>by {ev.createdByName}</>}
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
        <Panel title="Storage" description="Compressed photos across all events">
          <span className="text-3xl font-semibold tracking-tight text-navy-950 tabular-nums">{fileSize(t.storageBytes)}</span>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-navy-500">
            <HardDrive className="size-4" /> {num(t.photos)} photos · {t.photos ? fileSize(t.storageBytes / t.photos) : '0 B'} average after compression
          </p>
        </Panel>
        <Panel title="Photo processing" description="Photos by face-analysis status">
          <StatusStack counts={data.processing} />
        </Panel>
      </div>
    </div>
  )
}
