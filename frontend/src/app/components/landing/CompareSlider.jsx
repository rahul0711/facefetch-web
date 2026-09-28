import { ChevronsLeftRight, ScanFace } from 'lucide-react'
import { animate, motion, useInView, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef } from 'react'
import { byIds, pool, thumb } from '../../data/gallery'
import Photo from '../Photo'

// Aceternity-style "Compare": drag the handle between the shared folder
// everyone is scrolling through and the handful of photos you're actually in.
const YOURS = ['DVmEj6ptFbc', 'QbGPGsliC5w', 'LO1lToLGGFA', 'zc6ezUR4-8I', 'ee9plLQf41E', 'wmhehhmeA1o']
const FOLDER = ['wedding', 'party', 'collegefest', 'summit', 'music', 'corporate', 'birthday', 'sports', 'techfest', 'startup'].flatMap((e) => pool(e).slice(0, 9)).map(thumb)

export default function CompareSlider() {
  const box = useRef(null)
  const pos = useMotionValue(55) // % from the left where "yours" begins
  const inView = useInView(box, { once: true, amount: 0.5 })
  const clip = useTransform(pos, (v) => `inset(0 0 0 ${v}%)`)
  const left = useTransform(pos, (v) => `${v}%`)
  const yours = byIds(YOURS).map(thumb)

  // a small nudge the first time it's seen, so people know it moves
  useEffect(() => {
    if (!inView) return
    const c = animate(pos, [55, 38, 66, 50], { duration: 2.4, ease: 'easeInOut', delay: 0.3 })
    return () => c.stop()
  }, [inView, pos])

  return (
    <div
      ref={box}
      className="relative aspect-[4/5] overflow-hidden rounded-[28px] bg-navy-950 shadow-pop ring-1 ring-navy-900/10 select-none sm:aspect-[16/9]"
    >
      {/* before: the shared folder */}
      <div className="absolute inset-0 bg-navy-50 p-3 sm:p-4">
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
          {FOLDER.slice(0, 80).map((p) => (
            <Photo key={p.id} photo={p} className="aspect-square rounded-[5px] grayscale-[35%]" />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-navy-50 via-navy-50/80 to-transparent" />
        <div className="absolute bottom-5 left-5 max-w-[45%] sm:bottom-8 sm:left-8">
          <p className="text-[12px] font-semibold tracking-wide text-navy-500 uppercase">The shared folder</p>
          <p className="mt-1 font-display text-2xl font-semibold text-navy-950 sm:text-3xl">2,438 photos</p>
          <p className="mt-1 text-sm text-navy-500 max-sm:hidden">…and you’re in maybe 40 of them. Somewhere.</p>
        </div>
      </div>

      {/* after: only yours */}
      <motion.div className="absolute inset-0 bg-navy-950" style={{ clipPath: clip }}>
        <div aria-hidden className="absolute -top-1/3 right-0 size-[70%] rounded-full bg-brand-600/30 blur-[100px]" />
        <div className="absolute inset-x-4 top-4 bottom-28 grid grid-cols-2 grid-rows-3 gap-2 sm:top-8 sm:right-8 sm:bottom-32 sm:left-[14%] sm:grid-cols-3 sm:grid-rows-2 sm:gap-3">
          {yours.map((p) => (
            <Photo key={p.id} photo={p} className="size-full rounded-xl ring-1 ring-white/10" />
          ))}
        </div>
        <div className="absolute right-5 bottom-5 text-right sm:right-8 sm:bottom-8">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-cyan-300 uppercase">
            <ScanFace className="size-3.5" /> With Genesis Hub
          </p>
          <p className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">
            38 <span className="font-serif font-normal italic">of you</span>
          </p>
          <p className="mt-1 text-sm text-navy-300 max-sm:hidden">Found in about three seconds.</p>
        </div>
      </motion.div>

      {/* handle (the invisible range input below does the dragging, touch and keyboard) */}
      <motion.div className="absolute inset-y-0 w-px -translate-x-1/2 bg-white shadow-[0_0_20px_rgb(5_176_246/0.9)]" style={{ left }}>
        <span className="absolute top-1/2 left-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full bg-white text-navy-900 shadow-pop ring-4 ring-white/30">
          <ChevronsLeftRight className="size-5" />
        </span>
      </motion.div>
      <input
        type="range"
        min={8}
        max={92}
        defaultValue={55}
        onChange={(e) => pos.set(+e.target.value)}
        aria-label="Compare the shared folder with your photos"
        className="absolute inset-0 size-full cursor-ew-resize opacity-0"
        style={{ touchAction: 'pan-y' }}
      />
    </div>
  )
}
