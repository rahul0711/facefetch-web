import { ArrowRight, CalendarRange, CloudUpload, Download, Images, ScanFace, ScanSearch, Users } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { AreaChart, Panel } from '../../components/charts'
import { EventCover } from '../../components/console'
import Button from '../../components/ui/Button'
import { EmptyState, PageHeader, Skeleton, StatusBadge } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { compact, firstName, fmtDate, greeting } from '../../lib/utils'
import { adminOverview } from '../../services/analyticsService'
import { listAdminEvents } from '../../services/eventService'
import { PermissionChips } from './shared'

export function AssignedEventCard({ ev, stats, i }) {
  const st = stats || {}
  const metrics = [
    ['Photos', st.photos ?? ev.photoCount, Images],
    ['Faces', st.faces, ScanFace],
    ['Searches', st.searches, ScanSearch],
    ['Visitors', st.uniqueVisitors, Users],
    ['Downloads', st.downloads, Download],
  ]
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05 }}
      className="overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card"
    >
      <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <EventCover ev={ev} className="h-16 w-24 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/event-admin/events/${ev.id}`} className="truncate text-lg font-semibold text-navy-950 hover:text-brand-700">
              {ev.name}
            </Link>
            <StatusBadge status={ev.status} />
          </div>
          <p className="text-sm text-navy-500">{[ev.date && fmtDate(ev.date), ev.location].filter(Boolean).join(' · ') || ev.code}</p>
        </div>
        <div className="flex gap-2 max-sm:w-full">
          {ev.perms?.canUpload && (
            <Button variant="secondary" to={`/event-admin/events/${ev.id}/photos`} className="max-sm:flex-1">
              <CloudUpload /> Upload
            </Button>
          )}
          <Button to={`/event-admin/events/${ev.id}`} className="max-sm:flex-1">
            Open <ArrowRight />
          </Button>
        </div>
      </div>
      <dl className="grid grid-cols-3 border-t border-navy-100 sm:grid-cols-5">
        {metrics.map(([label, v, Icon], j) => (
          <div key={label} className={`border-navy-100 px-4 py-3 sm:px-5 ${j ? 'sm:border-l' : ''} ${j > 2 ? 'max-sm:border-t' : ''} ${j % 3 ? 'max-sm:border-l' : ''}`}>
            <dt className="flex items-center gap-1 text-[12px] text-navy-500">
              <Icon className="size-3" /> {label}
            </dt>
            <dd className="mt-0.5 font-semibold text-navy-900 tabular-nums">{v == null ? '—' : compact(v)}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-navy-100 bg-navy-50/40 px-4 pt-2 sm:px-5">
        {ev.perms && <PermissionChips perms={ev.perms} />}
      </div>
    </motion.article>
  )
}

export default function EADashboard() {
  useDocumentTitle('Overview')
  const { user } = useAuth()
  const { data: events, loading } = useQuery(() => listAdminEvents(), [])
  const { data: overview } = useQuery(() => adminOverview(30), [])

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`${greeting()}, ${firstName(user.name)}`}
        description={
          events
            ? `You manage ${events.length} event${events.length === 1 ? '' : 's'}. ${events.filter((e) => e.status === 'Active').length ? 'Guests are searching right now.' : ''}`
            : 'Loading your events…'
        }
      />

      {overview && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[
            ['Photos uploaded', overview.totals.photos, Images],
            ['Faces detected', overview.totals.faces, ScanFace],
            ['Guest searches', overview.totals.searches, ScanSearch],
            ['Downloads', overview.totals.downloads, Download],
          ].map(([l, v, Icon]) => (
            <div key={l} className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
              <p className="flex items-center justify-between text-[13px] font-medium text-navy-500">
                {l} <Icon className="size-4 text-navy-400" />
              </p>
              <p className="mt-2 text-[28px] leading-none font-semibold text-navy-950 tabular-nums">{compact(v)}</p>
            </div>
          ))}
        </div>
      )}

      <section className="grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-950">Assigned events</h2>
          <Link to="/event-admin/events" className="text-sm font-medium text-brand-700 hover:underline">
            View all
          </Link>
        </div>
        {loading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)
        ) : events.length ? (
          events.map((ev, i) => <AssignedEventCard key={ev.id} ev={ev} stats={overview?.perEvent[ev.id]} i={i} />)
        ) : (
          <EmptyState icon={CalendarRange} title="No events assigned yet" className="rounded-2xl border border-navy-100 bg-white">
            When a Super Admin assigns you to an event, it’ll appear here with everything you need to upload and manage photos.
          </EmptyState>
        )}
      </section>

      {overview && events?.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel title="Guest searches" description="Across your events, last 30 days" className="lg:col-span-2">
            <AreaChart data={overview.searches} unit="Searches" height={200} />
          </Panel>
          <Panel title="Photos uploaded" description="Last 30 days">
            <AreaChart data={overview.uploads} unit="Photos" height={200} />
          </Panel>
        </div>
      )}
    </div>
  )
}
