import { ArrowLeft, ArrowRight, CalendarDays, Camera, ImagePlus, Images, Lock, MapPin, ScanFace, ShieldCheck, Sparkles } from 'lucide-react'
import { motion } from 'motion/react'
import { Link, useParams } from 'react-router'
import Photo from '../../components/Photo'
import Button from '../../components/ui/Button'
import { EmptyState, Skeleton, StatusBadge } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { fmtDate, num } from '../../lib/utils'
import { AccessError, getGuestEvent } from '../../services/eventService'
import { lastSearch } from '../../services/searchService'

function EventHeroSkeleton() {
  return (
    <div className="container-page pt-6">
      <Skeleton className="h-[420px] w-full rounded-[28px]" />
      <Skeleton className="mt-10 h-8 w-64" />
      <div className="mt-6 grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-56 rounded-3xl" />
      </div>
    </div>
  )
}

export function EventUnavailable({ error }) {
  const denied = error instanceof AccessError
  return (
    <div className="container-page py-16">
      <EmptyState
        icon={denied ? Lock : ScanFace}
        title={denied ? 'This event isn’t available' : 'Event not found'}
        action={<Button to="/events">Back to your events</Button>}
        className="rounded-3xl bg-white ring-1 ring-navy-100"
      >
        {denied
          ? 'This event isn’t open for guests right now. If you attended, check back once the organizer publishes the photos.'
          : 'This event may have been removed, or the link is incorrect.'}
      </EmptyState>
    </div>
  )
}

export default function EventDetail() {
  const { eventId } = useParams()
  const { data: ev, error, loading } = useQuery(() => getGuestEvent(eventId), [eventId])
  const { data: prev } = useQuery(() => lastSearch(eventId).catch(() => null), [eventId])
  useDocumentTitle(ev?.name)

  if (loading) return <EventHeroSkeleton />
  if (error || !ev) return <EventUnavailable error={error} />

  const upcoming = !ev.photoCount

  return (
    <div className="pb-16">
      {/* hero */}
      <div className="container-page pt-4 sm:pt-6">
        <Link to="/events" className="mb-4 inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-navy-500 hover:text-navy-900">
          <ArrowLeft className="size-4" /> All events
        </Link>
        <div className="relative overflow-hidden rounded-[28px] bg-navy-950">
          {ev.cover && (
            <motion.div initial={{ scale: 1.06 }} animate={{ scale: 1 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }} className="absolute inset-0">
              <Photo photo={{ src: ev.cover, color: '#061a45' }} className="size-full" eager />
            </motion.div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/55 to-navy-950/10" />
          <div className="relative flex min-h-[380px] flex-col justify-end p-6 sm:min-h-[460px] sm:p-10">
            <StatusBadge status={ev.status} onDark className="mb-4 self-start" />
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-6xl"
            >
              {ev.name}
            </motion.h1>
            <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-white/85">
              {ev.date && (
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-cyan-300" /> {fmtDate(ev.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
              )}
              {ev.location && (
                <span className="flex items-center gap-2">
                  <MapPin className="size-4 text-cyan-300" /> {ev.location}
                </span>
              )}
              {!upcoming && (
                <span className="flex items-center gap-2">
                  <Images className="size-4 text-cyan-300" /> {num(ev.photoCount)} photos
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container-page mt-12">
        {upcoming ? (
          <EmptyState icon={CalendarDays} title="Photos aren’t ready yet" className="rounded-3xl bg-white ring-1 ring-navy-100">
            The photographers haven’t uploaded {ev.name} photos yet. Come back soon. Once they’re uploaded, you can find yourself in seconds.
          </EmptyState>
        ) : (
          <>
            {prev?.matchCount > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Link
                  to={`/events/${ev.id}/results`}
                  className="mb-8 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-brand-50 to-cyan-50 p-4 ring-1 ring-brand-100 transition-shadow hover:shadow-lift sm:p-5"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-brand-600 shadow-card">
                    <Sparkles className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-navy-950">You have {prev.matchCount} moments from this event</span>
                    <span className="block text-sm text-navy-500">From your last search. Search again anytime as more photos are added.</span>
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-brand-600" />
                </Link>
              </motion.div>
            )}

            <h2 className="text-2xl font-semibold text-navy-950 sm:text-3xl">Find your photos</h2>
            <p className="mt-2 text-navy-500">
              We’ll search only the {num(ev.photoCount)} photos from {ev.name}.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-[1.35fr_1fr]">
              {/* primary: selfie */}
              <Link
                to={`/events/${ev.id}/search?mode=selfie`}
                className="group relative overflow-hidden rounded-3xl bg-navy-950 p-6 text-white shadow-lift sm:p-8"
              >
                <div aria-hidden className="absolute -top-24 -right-24 size-72 rounded-full bg-brand-600/35 blur-3xl transition-transform duration-700 group-hover:scale-110" />
                <div aria-hidden className="absolute right-6 bottom-6 grid size-28 place-items-center rounded-full ring-1 ring-white/10 sm:size-36">
                  <span className="absolute inset-3 rounded-full ring-1 ring-cyan-300/25" />
                  <span className="grid size-16 place-items-center rounded-full bg-gradient-to-b from-brand-500 to-brand-700 shadow-[0_0_40px_rgb(7_105_238/0.6)] transition-transform duration-300 group-hover:scale-110 sm:size-20">
                    <Camera className="size-7 sm:size-8" />
                  </span>
                </div>
                <span className="relative inline-flex items-center gap-1.5 rounded-full bg-cyan-400/15 px-2.5 py-1 text-xs font-semibold text-cyan-200 ring-1 ring-cyan-300/30">
                  Recommended
                </span>
                <h3 className="relative mt-5 text-3xl font-semibold tracking-tight">Take a selfie</h3>
                <p className="relative mt-2 max-w-[60%] text-navy-300">The fastest way. Look at the camera, and we’ll do the rest in a few seconds.</p>
                <span className="relative mt-8 inline-flex items-center gap-2 text-sm font-semibold text-white">
                  Open camera <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>

              {/* secondary: upload */}
              <Link
                to={`/events/${ev.id}/search?mode=upload`}
                className="group flex flex-col rounded-3xl bg-white p-6 shadow-card ring-1 ring-navy-100 transition-shadow hover:shadow-lift sm:p-8"
              >
                <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600 transition-transform group-hover:-rotate-6">
                  <ImagePlus className="size-6" />
                </span>
                <h3 className="mt-6 text-2xl font-semibold tracking-tight text-navy-950">Upload a photo</h3>
                <p className="mt-2 text-navy-500">Use a clear photo of your face you already have.</p>
                <span className="mt-auto inline-flex items-center gap-2 pt-6 text-sm font-semibold text-brand-700">
                  Choose photo <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </div>

            <p className="mt-5 flex items-start gap-2 text-sm text-navy-500">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" />
              <span>
                Your photo is used to find your moments in this event only.{' '}
                <Link to="/consent" className="font-medium text-brand-700 hover:underline">
                  How we use it
                </Link>
              </span>
            </p>
          </>
        )}

        {ev.description && (
          <section className="mt-14 border-t border-navy-100 pt-10">
            <h2 className="font-semibold text-navy-950">About this event</h2>
            <p className="mt-2 max-w-3xl leading-relaxed whitespace-pre-line text-navy-600">{ev.description}</p>
          </section>
        )}
      </div>
    </div>
  )
}
