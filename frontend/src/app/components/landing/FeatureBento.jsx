import { Camera, Check, FileArchive, ImagePlus, Lock, ScanFace, Smartphone } from 'lucide-react'
import { motion, useInView } from 'motion/react'
import { useRef } from 'react'
import { byIds, selfie, thumb } from '../../data/gallery'
import { cn } from '../../lib/utils'
import Photo from '../Photo'

// Aceternity-style bento: every tile shows its feature working, and a soft
// spotlight follows the cursor across it.

function Tile({ className, title, text, children, dark, visualClassName }) {
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`)
  }
  return (
    <motion.article
      onMouseMove={onMove}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-[28px] ring-1 transition-shadow duration-300',
        dark ? 'bg-navy-950 text-white ring-white/10' : 'bg-white ring-navy-100 hover:shadow-lift',
        className,
      )}
    >
      {/* cursor spotlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(420px circle at var(--x, 50%) var(--y, 50%), ${dark ? 'rgb(5 176 246 / 0.14)' : 'rgb(7 105 238 / 0.07)'}, transparent 70%)`,
        }}
      />
      <div className={cn('relative z-10 flex-1', visualClassName ?? 'p-6 pb-0 sm:p-7 sm:pb-0')}>{children}</div>
      <div className="relative z-10 p-6 pt-5 sm:p-7 sm:pt-6">
        <h3 className={cn('text-lg font-semibold tracking-tight', dark ? 'text-white' : 'text-navy-950')}>{title}</h3>
        <p className={cn('mt-1.5 text-[15px] leading-relaxed', dark ? 'text-navy-300' : 'text-navy-500')}>{text}</p>
      </div>
    </motion.article>
  )
}

// A real concert photo: every face our detector found is boxed in, one by
// one, then one of them is picked out as "you".
const CROWD_ID = 'nPz8akkUmDI'
const YOU = 1

function CrowdScan() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.35 })
  const [p] = byIds([CROWD_ID])
  const you = p.faces[YOU]
  return (
    <div ref={ref} className="relative h-full min-h-72 overflow-hidden rounded-t-[28px] sm:min-h-96">
      <img src={p.src} alt={p.alt} className="absolute inset-0 size-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-t from-navy-950/60 via-transparent to-navy-950/10" />
      {/* a frame with the photo's own ratio, covering the tile exactly like the
          object-cover image does, so the face boxes land on the faces */}
      <div className="absolute top-1/2 left-1/2 min-h-full min-w-full -translate-x-1/2 -translate-y-1/2" style={{ aspectRatio: `${p.width} / ${p.height}` }}>
        {inView &&
          p.faces.map((f, i) => {
            const isYou = i === YOU
            return (
              <motion.span
                key={i}
                className={cn('absolute rounded-[30%] border', isYou ? 'z-10 border-2 border-cyan-300 shadow-[0_0_24px_rgb(5_176_246/0.9)]' : 'border-white/80')}
                style={{ left: `${f[0] * 100}%`, top: `${f[1] * 100}%`, width: `${(f[2] - f[0]) * 100}%`, height: `${(f[3] - f[1]) * 100}%` }}
                initial={{ opacity: 0, scale: 1.7 }}
                animate={isYou ? { opacity: 1, scale: 1 } : { opacity: [0, 1, 1, 0.25], scale: [1.7, 1, 1, 1] }}
                transition={isYou ? { delay: 0.25 + i * 0.06, duration: 0.5 } : { delay: 0.25 + i * 0.06, duration: 3, times: [0, 0.1, 0.62, 1] }}
              />
            )
          })}
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 2.6, duration: 0.5 }}
          className="absolute z-10 flex -translate-x-1/4 items-center gap-1 rounded-full bg-cyan-300 px-2.5 py-1 text-[12px] font-bold whitespace-nowrap text-navy-950 shadow-lg"
          style={{ left: `${you[0] * 100}%`, top: `${(you[3] + 0.025) * 100}%` }}
        >
          <ScanFace className="size-3.5" /> That’s you
        </motion.span>
      </div>
      <motion.span
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ delay: 0.3 }}
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-navy-950/70 px-3 py-1.5 text-[12px] font-medium text-white ring-1 ring-white/15 backdrop-blur"
      >
        <span className="size-1.5 animate-pulse rounded-full bg-cyan-300" /> {p.faces.length} faces found · 1 is you
      </motion.span>
    </div>
  )
}

// Scrolling the folder yourself vs. one selfie.
function Race() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const rows = [
    ['Scrolling the folder yourself', 'hours', '100%', 'bg-navy-200', 9],
    ['One selfie with Genesis Hub', 'seconds', '9%', 'bg-gradient-to-r from-brand-600 to-cyan-400', 0.9],
  ]
  return (
    <div ref={ref} className="grid h-full content-center gap-5 py-2">
      {rows.map(([label, time, width, bar, duration], i) => (
        <div key={label}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className={i ? 'font-semibold text-navy-950' : 'text-navy-500'}>{label}</span>
            <span className={cn('font-serif text-lg italic', i ? 'text-brand-600' : 'text-navy-400')}>{time}</span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-navy-50">
            <motion.div className={cn('h-full rounded-full', bar)} initial={{ width: 0 }} animate={inView ? { width } : {}} transition={{ duration, ease: i ? 'easeOut' : 'linear', delay: 0.2 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Decorative QR-style code: a fixed pattern plus the three finder squares.
// stable pseudo-random dots (an integer hash, so no rows or columns line up)
const QR = Array.from({ length: 121 }, (_, i) => {
  let h = Math.imul(i ^ 0x5bd1e995, 0x27d4eb2d)
  h ^= h >>> 15
  h = Math.imul(h, 0x165667b1)
  h ^= h >>> 13
  return (h >>> 0) % 100 < 46
})
const isFinder = (i) => {
  const x = i % 11
  const y = Math.floor(i / 11)
  const inBox = (bx, by) => x >= bx && x < bx + 3 && y >= by && y < by + 3
  return inBox(0, 0) || inBox(8, 0) || inBox(0, 8)
}

function NoInstall() {
  return (
    <div className="flex h-full items-center gap-5 py-2">
      <div className="grid size-28 shrink-0 grid-cols-11 gap-[2px] rounded-2xl bg-white p-2.5 shadow-lift ring-1 ring-navy-100">
        {QR.map((on, i) => (
          <span key={i} className={cn('rounded-[1px]', isFinder(i) || on ? 'bg-navy-950' : 'bg-transparent')} />
        ))}
      </div>
      <ul className="grid gap-2 text-sm text-navy-700">
        {['Opens in any browser', 'No account', 'No password'].map((t, i) => (
          <motion.li key={t} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.1 }} className="flex items-center gap-2">
            <span className="grid size-5 place-items-center rounded-full bg-ok/15 text-ok">
              <Check className="size-3" strokeWidth={3} />
            </span>
            {t}
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

// The selfie turns into a face signature (a list of numbers), then it's gone.
const SIGNATURE = [0.62, 0.31, 0.85, 0.44, 0.93, 0.27, 0.71, 0.52, 0.38, 0.8, 0.22, 0.66, 0.49, 0.9, 0.35, 0.58, 0.76, 0.3]
function Private() {
  return (
    <div className="grid h-full content-center gap-4 py-2">
      <div className="flex items-center gap-3">
        <motion.div
          className="size-16 shrink-0 overflow-hidden rounded-2xl ring-2 ring-cyan-300"
          whileInView={{ opacity: [1, 1, 0.15], scale: [1, 1, 0.85], filter: ['blur(0px)', 'blur(0px)', 'blur(6px)'] }}
          viewport={{ once: true }}
          transition={{ duration: 2.6, times: [0, 0.6, 1], delay: 0.4 }}
        >
          <img src={selfie.src} alt="" className="size-full object-cover object-[50%_22%]" loading="lazy" />
        </motion.div>
        <div className="flex h-12 flex-1 items-end gap-[3px]">
          {SIGNATURE.map((h, i) => (
            <motion.span
              key={i}
              className="flex-1 rounded-sm bg-gradient-to-t from-brand-500 to-cyan-300"
              initial={{ height: '8%' }}
              whileInView={{ height: `${h * 100}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 + i * 0.04, duration: 0.5 }}
            />
          ))}
        </div>
      </div>
      <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-medium text-cyan-200 ring-1 ring-white/10">
        <Lock className="size-3.5" /> Selfie discarded after the search
      </p>
    </div>
  )
}

function DownloadAll() {
  const photos = byIds(['DVmEj6ptFbc', 'QbGPGsliC5w', 'ee9plLQf41E']).map(thumb)
  return (
    <div className="relative grid h-full min-h-40 place-items-center">
      {photos.map((p, i) => (
        <motion.div
          key={p.id}
          className="absolute w-32 sm:w-36"
          initial={{ rotate: 0, x: 0 }}
          whileInView={{ rotate: (i - 1) * 9, x: (i - 1) * 34, y: i === 1 ? -8 : 4 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 120, damping: 14 }}
          style={{ zIndex: i === 1 ? 2 : 1 }}
        >
          <Photo photo={p} ratio="4 / 3" className="rounded-xl shadow-lift ring-4 ring-white" />
        </motion.div>
      ))}
      <span className="absolute bottom-1 z-10 inline-flex items-center gap-1.5 rounded-full bg-navy-950 px-3 py-1.5 text-[12px] font-semibold text-white shadow-lg">
        <FileArchive className="size-3.5" /> 38 photos.zip
      </span>
    </div>
  )
}

function AnyCamera() {
  return (
    <div className="grid h-full content-center gap-2.5 py-2">
      {[
        [Camera, 'Live selfie', 'front or back camera'],
        [ImagePlus, 'Upload a photo', 'one you already have'],
        [Smartphone, 'Any device', 'iPhone, Android or laptop'],
      ].map(([Icon, t, d], i) => (
        <motion.div
          key={t}
          initial={{ opacity: 0, x: -10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 + i * 0.1 }}
          className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-2.5 ring-1 ring-white/10"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-brand-600 text-white">
            <Icon className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">{t}</span>
            <span className="block text-[12px] text-navy-300">{d}</span>
          </span>
        </motion.div>
      ))}
    </div>
  )
}

export default function FeatureBento() {
  return (
    <div className="grid gap-4 md:grid-cols-6">
      <Tile className="md:col-span-6 lg:col-span-4 lg:row-span-2" visualClassName="" title="Finds you in a crowd" text="Every face in every photo is detected and indexed, even the back rows of a packed concert.">
        <CrowdScan />
      </Tile>
      <Tile className="md:col-span-3 lg:col-span-2" title="Seconds, not hours" text="No more zooming into every group photo. One selfie searches the whole event.">
        <Race />
      </Tile>
      <Tile className="md:col-span-3 lg:col-span-2" title="Nothing to install" text="Guests scan the code or tap the link and search right in their browser.">
        <NoInstall />
      </Tile>
      <Tile dark className="md:col-span-2" title="Your selfie stays yours" text="Used once to search, then thrown away. Never stored, never in the gallery.">
        <Private />
      </Tile>
      <Tile className="md:col-span-2" title="Download everything" text="Full-quality photos, one at a time or all together in a single zip.">
        <DownloadAll />
      </Tile>
      <Tile dark className="md:col-span-2" title="Any phone, any camera" text="A live selfie or a photo you like. Both work the same.">
        <AnyCamera />
      </Tile>
    </div>
  )
}
