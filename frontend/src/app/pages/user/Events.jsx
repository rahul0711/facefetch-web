import { ArrowRight, CalendarClock, CalendarHeart, Camera, Images, MapPin, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import Photo from '../../components/Photo'
import Button from '../../components/ui/Button'
import { EmptyState, Skeleton, StatusBadge } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { cn, compact, firstName, fmtDate, greeting } from '../../lib/utils'
import { listGuestEvents } from '../../services/eventService'
import { lastSearch } from '../../services/searchService'

function EventCard({ ev, userId, i }) {
  const navigate = useNavigate()
  const upcoming = ev.status === 'Upcoming'
  const prev = lastSearch(ev.id, userId)
  const to = upcoming ? `/events/${ev.id}` : prev ? `/events/${ev.id}/results` : `/events/${ev.id}`
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-navy-100 transition-shadow duration-300 hover:shadow-lift"
    >
      <Link to={`/events/${ev.id}`} className="relative block aspect-[16/10] overflow-hidden" aria-label={`${ev.name} details`}>
        {ev.cover ? (
          <Photo photo={{ src: ev.cover, color: '#0f2452' }} className="size-full" imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-navy-900 to-brand-800 text-white/70">
            <CalendarClock className="size-10" strokeWidth={1.4} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/70 via-transparent to-transparent" />
        <StatusBadge status={ev.status} onDark className="absolute top-3 left-3" />
        {prev && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-navy-900 shadow-sm">
            <Sparkles className="size-3.5 text-brand-600" /> {prev.hits.length} moments found
          </span>
        )}
        <div className="absolute inset-x-4 bottom-3 flex items-center gap-1.5 text-[13px] font-medium text-white/90">
          <Images className="size-4" /> {ev.stats.photos ? `${compact(ev.stats.photos)} photos` : 'Photos coming soon'}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <h2 className="text-lg font-semibold text-navy-950">{ev.name}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy-500">
          <span>{fmtDate(ev.date)}</span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" /> {ev.city}
          </span>
        </p>
        <div className="mt-5 flex items-center gap-2">
          {upcoming ? (
            <Button variant="secondary" className="w-full" to={to}>
              Photos after the event
            </Button>
          ) : prev ? (
            <>
              <Button className="flex-1" to={to}>
                View my photos <ArrowRight />
              </Button>
              <Button variant="secondary" size="icon" aria-label="Search again" onClick={() => navigate(`/events/${ev.id}/search?mode=selfie`)}>
                <Camera />
              </Button>
            </>
          ) : (
            <Button className="w-full" to={to}>
              <Camera /> Find My Photos
            </Button>
          )}
        </div>
      </div>
    </motion.article>
  )
}

export default function Events() {
  useDocumentTitle('Your events')
  const { user } = useAuth()
  const { data: events, loading } = useQuery(() => listGuestEvents(user.id), [user.id])
  const live = events?.filter((e) => e.status !== 'Upcoming') || []
  const upcoming = events?.filter((e) => e.status === 'Upcoming') || []

  return (
    <div className="container-page py-10 sm:py-14">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-brand-700">
          {greeting()}, {firstName(user.name)}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-navy-950 sm:text-5xl">Find your moments.</h1>
        <p className="mt-3 text-lg text-navy-500">Choose an event and we’ll find every photo you’re in.</p>
      </header>

      {loading ? (
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-3xl bg-white ring-1 ring-navy-100">
              <Skeleton className="aspect-[16/10] rounded-none" />
              <div className="grid gap-3 p-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="mt-2 h-10 w-full rounded-[10px]" />
              </div>
            </div>
          ))}
        </div>
      ) : !events?.length ? (
        <EmptyState icon={CalendarHeart} title="No events yet" className="mt-10 rounded-3xl bg-white ring-1 ring-navy-100">
          When an organizer invites you to an event, it’ll appear here. Ask them for the event link, or check the email you signed up with.
        </EmptyState>
      ) : (
        <>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {live.map((ev, i) => (
              <EventCard key={ev.id} ev={ev} userId={user.id} i={i} />
            ))}
          </div>
          {upcoming.length > 0 && (
            <section className="mt-16">
              <h2 className="text-lg font-semibold text-navy-950">Coming up</h2>
              <p className="mt-1 text-sm text-navy-500">Photos will be ready to search after the event.</p>
              <div className={cn('mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3')}>
                {upcoming.map((ev, i) => (
                  <EventCard key={ev.id} ev={ev} userId={user.id} i={i} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
