import { ArrowLeft, ChevronLeft, ChevronRight, Download, ScanFace, Share2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { HeartButton } from '../../components/MomentGrid'
import { FaceBox } from '../../components/Photo'
import ShareModal from '../../components/ShareModal'
import { Kbd } from '../../components/ui/primitives'
import { useDocumentTitle } from '../../lib/hooks'
import { usePhotoActions } from '../../lib/photoActions'
import { cn } from '../../lib/utils'
import { db } from '../../services/db'
import { matchLabel } from '../../services/searchService'
import { applyView, useMatches } from './Results'

export default function PhotoViewer() {
  const { eventId, photoId } = useParams()
  const [params] = useSearchParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const actions = usePhotoActions(user)
  const { items } = useMatches(eventId, user.id)
  const ev = db().events.find((e) => e.id === eventId)
  const allowed = (db().guestAccess[user.id] || []).includes(eventId)

  const list = useMemo(() => {
    const view = applyView(items, params.get('filter') || 'all', params.get('sort') || 'best')
    if (view.some((i) => i.photo.id === photoId)) return view
    // e.g. a favorite whose search history was cleared: show it on its own
    const lone = db().photos.find((p) => p.id === photoId && p.eventId === eventId)
    return lone ? [{ photo: lone, score: null, box: null }] : view
  }, [items, params, photoId, eventId])
  const index = list.findIndex((i) => i.photo.id === photoId)
  const item = list[index]
  const [dir, setDir] = useState(0)
  const [showFace, setShowFace] = useState(true)
  const [sharing, setSharing] = useState(false)
  const strip = useRef(null)
  useDocumentTitle(ev ? `Photo ${index + 1} of ${list.length} · ${ev.name}` : 'Photo')

  const back = useCallback(() => navigate(`/events/${eventId}/results`), [navigate, eventId])
  const go = useCallback(
    (d) => {
      if (!list.length) return
      const next = list[(index + d + list.length) % list.length]
      setDir(d)
      navigate(`/events/${eventId}/photo/${encodeURIComponent(next.photo.id)}?${params}`, { replace: true })
    },
    [list, index, navigate, eventId, params],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('[role="dialog"]')) return
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === 'Escape') back()
      else if (e.key.toLowerCase() === 'f' && item) actions.toggleFav(item.photo)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, back, item, actions])

  // keep the current thumbnail in view
  useEffect(() => {
    strip.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [index])

  if (!ev || !allowed) return <Navigate to="/events" replace />
  if (!item) return <Navigate to={`/events/${eventId}/results`} replace />

  const { photo, score, box } = item
  const label = score != null ? matchLabel(score) : null
  const fav = actions.isFav(photo.id)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#04070f] text-white">
      {/* top bar */}
      <div className="relative z-10 flex items-center gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 sm:px-5">
        <button onClick={back} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Back to results">
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{ev.name}</p>
          <p className="text-[13px] text-white/55 tabular-nums">
            {index + 1} of {list.length}
          </p>
        </div>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <HeartButton on={fav} onClick={() => actions.toggleFav(photo)} className={fav ? '' : 'bg-white/10'} size="lg" />
          <button onClick={() => setSharing(true)} className="grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/15" aria-label="Share">
            <Share2 className="size-5" />
          </button>
          <button onClick={() => actions.download(photo, ev.name)} className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-navy-950 hover:bg-navy-50">
            <Download className="size-4" /> Download
          </button>
        </div>
      </div>

      {/* stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-20">
        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <motion.div
            key={photo.id}
            custom={dir}
            initial={{ opacity: 0, x: dir * 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -60 }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70 || info.velocity.x < -400) go(1)
              else if (info.offset.x > 70 || info.velocity.x > 400) go(-1)
            }}
            className="relative touch-pan-y"
            style={{
              aspectRatio: `${photo.width} / ${photo.height}`,
              width: `min(100%, calc((100dvh - var(--chrome, 250px)) * ${photo.width / photo.height}))`,
            }}
          >
            <img src={photo.src} alt={photo.alt} draggable={false} className="size-full rounded-lg object-cover sm:rounded-xl" />
            {showFace && box && <FaceBox box={box} delay={0.25} />}
          </motion.div>
        </AnimatePresence>
        {list.length > 1 && (
          <>
            <button onClick={() => go(-1)} className="absolute left-4 hidden size-12 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20 sm:grid" aria-label="Previous photo">
              <ChevronLeft className="size-6" />
            </button>
            <button onClick={() => go(1)} className="absolute right-4 hidden size-12 place-items-center rounded-full bg-white/10 backdrop-blur hover:bg-white/20 sm:grid" aria-label="Next photo">
              <ChevronRight className="size-6" />
            </button>
          </>
        )}
      </div>

      {/* info panel */}
      <div className="relative z-10 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          {label ? (
          <button
            onClick={() => setShowFace((v) => !v)}
            className="flex items-center gap-3 rounded-2xl bg-white/[0.06] py-2 pr-4 pl-2 text-left ring-1 ring-white/10 hover:bg-white/10"
            aria-pressed={showFace}
          >
            <span className={cn('grid size-9 place-items-center rounded-xl', showFace ? 'bg-cyan-300 text-navy-950' : 'bg-white/10 text-white')}>
              <ScanFace className="size-5" />
            </span>
            <span>
              <span className="block text-sm font-medium">Face found · {Math.round(score * 100)}% match</span>
              <span className="block text-[12px] text-white/55">
                {label.text} · {showFace ? 'Tap to hide highlight' : 'Tap to show highlight'}
              </span>
            </span>
          </button>
          ) : (
            <span className="text-sm text-white/60">From your favorites</span>
          )}
          <p className="text-[12px] text-white/45 max-sm:hidden">
            {new Date(photo.takenAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
            {photo.credit && (
              <>
                {' · '}Photo by{' '}
                <a href={`${photo.credit.url}?utm_source=facefetch_demo&utm_medium=referral`} target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-2 hover:text-white">
                  {photo.credit.name}
                </a>
              </>
            )}
          </p>
          <span className="hidden items-center gap-2 text-[12px] text-white/40 lg:flex">
            <Kbd>←</Kbd>
            <Kbd>→</Kbd> browse <Kbd>F</Kbd> favorite
          </span>
        </div>

        {/* mobile actions */}
        <div className="mt-3 grid grid-cols-3 gap-2 md:hidden">
          <button onClick={() => actions.toggleFav(photo)} className={cn('flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-medium', fav ? 'bg-white text-rose-500' : 'bg-white/10')}>
            <HeartIcon on={fav} /> {fav ? 'Saved' : 'Favorite'}
          </button>
          <button onClick={() => actions.download(photo, ev.name)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-medium text-navy-950">
            <Download className="size-4" /> Save
          </button>
          <button onClick={() => setSharing(true)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-medium">
            <Share2 className="size-4" /> Share
          </button>
        </div>

        {/* filmstrip */}
        {list.length > 1 && (
          <div ref={strip} className="scrollbar-none mx-auto mt-3 flex max-w-4xl gap-1.5 overflow-x-auto max-md:hidden">
            {list.map((it, i) => (
              <button
                key={it.photo.id}
                aria-current={i === index}
                aria-label={`Photo ${i + 1}`}
                onClick={() => go(i - index)}
                className={cn('h-14 shrink-0 overflow-hidden rounded-md transition-[opacity,box-shadow]', i === index ? 'opacity-100 ring-2 ring-cyan-300' : 'opacity-45 hover:opacity-80')}
                style={{ aspectRatio: `${it.photo.width} / ${it.photo.height}` }}
              >
                <img src={it.photo.src} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <ShareModal open={sharing} onClose={() => setSharing(false)} event={ev} photo={photo} />
    </div>
  )
}

function HeartIcon({ on }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}
