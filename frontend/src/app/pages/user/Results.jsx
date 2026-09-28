import { ArrowLeft, Camera, Download, Heart, ImagePlus, ScanFace, Share2, SlidersHorizontal } from 'lucide-react'
import { motion } from 'motion/react'
import { useMemo, useState } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { TextReveal } from '../../components/effects'
import MomentGrid from '../../components/MomentGrid'
import ShareModal from '../../components/ShareModal'
import Button from '../../components/ui/Button'
import { EmptyState, Segmented, Select, Skeleton } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { usePhotoActions } from '../../lib/photoActions'
import { fmtDate, timeAgo } from '../../lib/utils'
import { getGuestEvent } from '../../services/eventService'
import { lastSearch } from '../../services/searchService'
import { EventUnavailable } from './EventDetail'

// Latest search for this event: this session's (with face boxes) or the saved one.
export function useMatches(eventId) {
  const { data, loading } = useQuery(() => lastSearch(eventId), [eventId], { live: false })
  return { search: data, items: data?.hits || [], loading }
}

const FILTERS = [
  { value: 'all', label: 'All', test: () => true },
  { value: 'strong', label: 'Strong matches', test: (h) => h.score >= 0.6 },
  { value: 'group', label: 'Group photos', test: (h) => h.photo.faceCount >= 3 },
  { value: 'portrait', label: 'Portraits', test: (h) => h.photo.faceCount <= 2 },
]

const SORTS = {
  best: (a, b) => b.score - a.score,
  newest: (a, b) => String(b.photo.takenAt).localeCompare(String(a.photo.takenAt)),
  oldest: (a, b) => String(a.photo.takenAt).localeCompare(String(b.photo.takenAt)),
}

export function applyView(items, filter, sort) {
  const f = FILTERS.find((x) => x.value === filter)
  return items.filter(f.test).sort(SORTS[sort])
}

export default function Results() {
  const { eventId } = useParams()
  const { user } = useAuth()
  const fresh = useLocation().state?.fresh
  const { data: ev, error, loading: loadingEvent } = useQuery(() => getGuestEvent(eventId), [eventId], { live: false })
  const { search, items, loading: loadingSearch } = useMatches(eventId)
  const loading = loadingEvent || loadingSearch
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('best')
  const [sharing, setSharing] = useState(null) // photo | 'all'
  const actions = usePhotoActions(user)
  useDocumentTitle(ev ? `Your moments · ${ev.name}` : 'Your moments')

  const view = useMemo(() => applyView(items, filter, sort), [items, filter, sort])

  if (!search && !loading) return <Navigate to={`/events/${eventId}`} replace />
  if (loading) {
    return (
      <div className="container-page py-10">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-12 w-2/3 max-w-xl" />
        <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {[1.3, 0.8, 1.1, 0.75, 1, 1.2, 0.8, 1].map((r, i) => (
            <Skeleton key={i} className="rounded-2xl" style={{ aspectRatio: `1 / ${r}` }} />
          ))}
        </div>
      </div>
    )
  }
  if (error || !ev) return <EventUnavailable error={error} />

  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, items.filter(f.test).length]))
  const allFav = items.length > 0 && items.every((i) => actions.isFav(i.photo.id))

  if (!items.length) {
    return (
      <div className="container-page py-12">
        <EmptyState
          icon={ScanFace}
          title="We couldn’t find you this time"
          className="rounded-3xl bg-white ring-1 ring-navy-100"
          action={
            <>
              <Button to={`/events/${eventId}/search?mode=selfie`}>
                <Camera /> Retake selfie
              </Button>
              <Button to={`/events/${eventId}/search?mode=upload`} variant="secondary">
                <ImagePlus /> Upload a different photo
              </Button>
            </>
          }
        >
          None of the {ev.photoCount.toLocaleString()} photos from {ev.name} matched. Try a clear, front-facing selfie in good light. Photographers may also still be uploading.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="container-page py-8 sm:py-12">
      <Link to={`/events/${eventId}`} className="inline-flex items-center gap-1.5 rounded-lg py-1 text-sm font-medium text-navy-500 hover:text-navy-900">
        <ArrowLeft className="size-4" /> {ev.name}
      </Link>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          {fresh ? (
            <TextReveal as="h1" text={`We found ${items.length} moments for you.`} className="block text-4xl font-semibold tracking-tight text-navy-950 sm:text-5xl" />
          ) : (
            <h1 className="text-4xl font-semibold tracking-tight text-navy-950 sm:text-5xl">
              We found {items.length} moments for you.
            </h1>
          )}
          <motion.p initial={fresh ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-3 text-lg text-navy-500">
            Here are the photos from {ev.name} where we found you.
          </motion.p>
          <p className="mt-1 text-sm text-navy-400">
            {ev.date && `${fmtDate(ev.date)} · `}searched {timeAgo(search.at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 max-sm:grid max-sm:w-full max-sm:grid-cols-[1fr_1fr_auto]">
          <Button onClick={() => actions.downloadAll(items.map((i) => i.photo), ev.name)} loading={actions.zipping} size="lg" className="max-sm:flex-1">
            {!actions.zipping && <Download />} Download all
          </Button>
          <Button variant="secondary" size="lg" onClick={() => actions.favAll(items.map((i) => i.photo))} disabled={allFav} className="max-sm:flex-1">
            <Heart className={allFav ? 'fill-rose-500 text-rose-500' : ''} /> {allFav ? 'All favorited' : 'Favorite all'}
          </Button>
          <Button variant="secondary" size="icon" className="size-12 rounded-xl" onClick={() => setSharing('all')} aria-label="Share your moments">
            <Share2 />
          </Button>
        </div>
      </header>

      <div className="sticky top-16 z-30 -mx-4 mt-8 flex items-center gap-3 border-b border-navy-100/80 bg-canvas/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="scrollbar-none -my-1 min-w-0 flex-1 overflow-x-auto py-1">
          <Segmented label="Filter photos" size="sm" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ value: f.value, label: f.label, count: counts[f.value] }))} />
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm text-navy-500">
          <SlidersHorizontal className="size-4 max-sm:hidden" />
          <span className="sr-only">Sort by</span>
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-9 w-[124px] rounded-lg py-0 pr-8 text-sm sm:w-[132px]">
            <option value="best">Best match</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </Select>
        </label>
      </div>

      <div className="mt-6">
        {view.length ? (
          <MomentGrid
            items={view}
            actions={{ ...actions, download: (p) => actions.download(p, ev.name), onShare: setSharing }}
            linkFor={(it) => `/events/${eventId}/photo/${encodeURIComponent(it.photo.id)}?filter=${filter}&sort=${sort}`}
          />
        ) : (
          <EmptyState icon={SlidersHorizontal} title="Nothing in this filter" action={<Button variant="secondary" onClick={() => setFilter('all')}>Show all moments</Button>}>
            Try another filter to see the rest of your photos.
          </EmptyState>
        )}
      </div>

      <div className="mt-14 flex flex-col items-center gap-3 rounded-3xl border border-dashed border-navy-200 p-8 text-center">
        <p className="font-medium text-navy-900">Missing a photo?</p>
        <p className="max-w-md text-sm text-navy-500">Photographers keep uploading after the event. Search again later, or try a photo with different lighting.</p>
        <Button to={`/events/${eventId}/search?mode=selfie`} variant="secondary" className="mt-2">
          <Camera /> Search again
        </Button>
      </div>

      <ShareModal
        open={!!sharing}
        onClose={() => setSharing(null)}
        event={ev}
        photo={sharing === 'all' ? null : sharing}
        count={items.length}
      />
    </div>
  )
}
