import { ShieldCheck } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import { AssignAdminsPanel } from '../../components/AssignAdmins'
import { PERMISSIONS } from '../../services/adapters'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { getEvent } from '../../services/eventService'
import { EventBanner, EventDetailSkeleton } from './EventDetail'

export default function AssignAdmins() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const { data: ev, loading } = useQuery(() => getEvent(eventId), [eventId], { live: false })
  useDocumentTitle('Assign event admins')
  if (loading || !ev) return <EventDetailSkeleton />
  return (
    <div className="grid gap-6">
      <EventBanner ev={ev} back={{ to: `/admin/events/${ev.id}`, label: ev.name }} />
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <section className="rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:p-6">
          <h2 className="text-lg font-semibold text-navy-950">Assign event admins</h2>
          <p className="mt-1 mb-5 text-sm text-navy-500">Select who can manage {ev.name}, then set what each of them can do.</p>
          <AssignAdminsPanel event={ev} onDone={() => navigate(`/admin/events/${ev.id}`)} />
        </section>
        <aside className="rounded-2xl bg-navy-950 p-6 text-navy-200">
          <ShieldCheck className="size-6 text-cyan-300" />
          <h3 className="mt-4 font-semibold text-white">How event access works</h3>
          <p className="mt-2 text-sm leading-relaxed">
            Access is per event. An admin assigned to {ev.name} can’t see any other event unless you assign them there too.
          </p>
          <ul className="mt-5 grid gap-3 text-sm">
            {PERMISSIONS.map((p) => (
              <li key={p.key}>
                <span className="font-medium text-white">{p.label}</span>
                <span className="block text-[13px] text-navy-400">{p.hint}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
