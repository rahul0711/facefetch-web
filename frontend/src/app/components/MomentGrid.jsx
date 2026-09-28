import { Download, Heart, Share2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { useMediaQuery } from '../lib/hooks'
import { cn } from '../lib/utils'
import { matchLabel } from '../services/searchService'
import Photo from './Photo'

// Masonry that keeps reading order (best match first, left to right) by
// placing each photo in the currently shortest column.
function useColumns(items, count) {
  return useMemo(() => {
    const cols = Array.from({ length: count }, () => ({ h: 0, items: [] }))
    items.forEach((it, i) => {
      const col = cols.reduce((a, b) => (b.h < a.h ? b : a))
      col.items.push({ ...it, index: i })
      col.h += (it.photo.height || 3) / (it.photo.width || 4) + 0.04
    })
    return cols.map((c) => c.items)
  }, [items, count])
}

export function HeartButton({ on, onClick, className, size = 'md' }) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick()
      }}
      aria-label={on ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={on}
      className={cn(
        'grid place-items-center rounded-full backdrop-blur-md transition-colors',
        size === 'md' ? 'size-9' : 'size-11',
        on ? 'bg-white text-rose-500' : 'bg-navy-950/40 text-white hover:bg-navy-950/60',
        className,
      )}
    >
      <motion.span key={String(on)} initial={{ scale: on ? 0.4 : 1 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 15 }}>
        <Heart className={cn(size === 'md' ? 'size-[18px]' : 'size-5', on && 'fill-current')} />
      </motion.span>
    </button>
  )
}

function MomentCard({ item, to, actions, showMatch }) {
  const { photo, box, score } = item
  const fav = actions.isFav(photo.id)
  const label = score != null ? matchLabel(score) : null
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.45, delay: Math.min(item.index, 12) * 0.045, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      <Link to={to} className="block overflow-hidden rounded-2xl" aria-label={`Open photo ${item.index + 1}`}>
        <Photo photo={photo} ratio="natural" face={box || undefined} faceDelay={0.3 + Math.min(item.index, 12) * 0.05} imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
        <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-t from-navy-950/50 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 max-md:hidden" />
      </Link>
      {showMatch && label?.tone === 'strong' && (
        <span className="pointer-events-none absolute top-2.5 left-2.5 rounded-full bg-navy-950/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">
          {Math.round(score * 100)}% match
        </span>
      )}
      <HeartButton on={fav} onClick={() => actions.toggleFav(photo)} className={cn('absolute top-2.5 right-2.5', !fav && 'md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100')} />
      <div className="absolute right-2.5 bottom-2.5 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 max-md:hidden">
        <button onClick={() => actions.onShare(photo)} className="grid size-9 place-items-center rounded-full bg-white/90 text-navy-900 hover:bg-white" aria-label="Share photo">
          <Share2 className="size-4" />
        </button>
        <button onClick={() => actions.download(photo)} className="grid size-9 place-items-center rounded-full bg-white/90 text-navy-900 hover:bg-white" aria-label="Download photo">
          <Download className="size-4" />
        </button>
      </div>
    </motion.div>
  )
}

export default function MomentGrid({ items, linkFor, actions, showMatch = true }) {
  const md = useMediaQuery('(min-width: 768px)')
  const xl = useMediaQuery('(min-width: 1280px)')
  const cols = useColumns(items, xl ? 4 : md ? 3 : 2)
  return (
    <div className="flex gap-2.5 sm:gap-4">
      {cols.map((col, ci) => (
        <div key={ci} className="flex min-w-0 flex-1 flex-col gap-2.5 sm:gap-4">
          <AnimatePresence mode="popLayout">
            {col.map((it) => (
              <MomentCard key={it.photo.id} item={it} to={linkFor(it)} actions={actions} showMatch={showMatch} />
            ))}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}
