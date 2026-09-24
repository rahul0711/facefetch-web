import { Check, ScanFace } from 'lucide-react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { avatars, largestFace, pool } from '../../data/gallery'
import { cn } from '../../lib/utils'
import { FaceBox } from '../Photo'

const TILES = pool('wedding').slice(0, 12)
const MATCHED = new Set([1, 4, 6, 10])
const PHASES = ['scan', 'match', 'collect']
const DURATION = { scan: 2600, match: 1700, collect: 3000 }

const STATUS = {
  scan: 'Scanning 2,438 photos…',
  match: 'Comparing faces…',
  collect: '4 moments found',
}

export default function HeroVisual() {
  const reduce = useReducedMotion()
  const [phase, setPhase] = useState(reduce ? 'collect' : 'scan')

  useEffect(() => {
    if (reduce) return
    const t = setTimeout(() => setPhase((p) => PHASES[(PHASES.indexOf(p) + 1) % PHASES.length]), DURATION[phase])
    return () => clearTimeout(t)
  }, [phase, reduce])

  const collected = phase === 'collect'
  const matching = phase !== 'scan'

  return (
    <div className="relative mx-auto w-full max-w-[560px] select-none" aria-hidden>
      <LayoutGroup>
        {/* event photo wall */}
        <div className="relative rounded-[28px] bg-white/[0.04] p-3 ring-1 ring-white/10 backdrop-blur-sm">
          <div className="mb-3 flex items-center justify-between px-1 text-[12px] text-navy-300">
            <span className="font-medium text-white/80">Sarah &amp; Arjun Wedding</span>
            <span>2,438 photos</span>
          </div>
          <div className="relative grid grid-cols-3 gap-2 sm:grid-cols-4">
            {TILES.map((p, i) => {
              const isMatch = MATCHED.has(i)
              const inTray = collected && isMatch
              return (
                <div key={p.id} className={cn('relative aspect-[4/3] rounded-xl', i >= 9 && 'max-sm:hidden')}>
                  {inTray ? (
                    <div className="size-full rounded-xl border border-dashed border-white/15" />
                  ) : (
                    <motion.div
                      layoutId={`hero-${p.id}`}
                      transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                      className={cn(
                        'relative size-full overflow-hidden rounded-xl transition-[opacity,filter] duration-500',
                        matching && !isMatch && 'opacity-35 saturate-50',
                      )}
                    >
                      <img src={p.src} alt="" className="size-full object-cover" loading="eager" />
                      {matching && isMatch && (
                        <>
                          <FaceBox box={largestFace(p)} className="rounded-md border-[1.5px]" />
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-cyan-400 text-navy-950"
                          >
                            <Check className="size-3" strokeWidth={3.5} />
                          </motion.span>
                        </>
                      )}
                    </motion.div>
                  )}
                </div>
              )
            })}
            {/* scan sweep */}
            <AnimatePresence>
              {phase === 'scan' && (
                <motion.div
                  key="sweep"
                  className="pointer-events-none absolute inset-x-0 top-0 h-1/3 rounded-xl"
                  style={{ background: 'linear-gradient(180deg, transparent, rgb(5 176 246 / 0.16) 70%, rgb(5 176 246 / 0.55))', borderBottom: '1.5px solid rgb(114 209 251)' }}
                  initial={{ y: '-100%', opacity: 0 }}
                  animate={{ y: '300%', opacity: [0, 1, 1, 0] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 2.4, ease: 'easeInOut' }}
                />
              )}
            </AnimatePresence>
          </div>

          {/* results tray */}
          {/* left padding leaves room for the selfie card that overlaps this corner */}
          <div className="mt-3 rounded-2xl bg-navy-950/60 p-3 pl-[118px] ring-1 ring-white/10 sm:pl-[128px]">
            <div className="mb-2 flex items-center justify-between text-[12px]">
              <span className="font-medium text-white">Your moments</span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={phase}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={collected ? 'font-medium text-cyan-300' : 'text-navy-300'}
                >
                  {STATUS[phase]}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[...MATCHED].map((i) => {
                const p = TILES[i]
                return (
                  <div key={p.id} className="aspect-[4/3] rounded-lg bg-white/[0.04] ring-1 ring-white/5">
                    {collected && (
                      <motion.div
                        layoutId={`hero-${p.id}`}
                        transition={{ type: 'spring', stiffness: 170, damping: 24 }}
                        className="relative size-full overflow-hidden rounded-lg ring-1 ring-cyan-300/60"
                      >
                        <img src={p.src} alt="" className="size-full object-cover" />
                      </motion.div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </LayoutGroup>

      {/* the selfie */}
      <motion.div
        initial={{ opacity: 0, y: 20, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: -4 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 120, damping: 18 }}
        className="absolute -bottom-7 -left-3 w-[118px] rounded-[20px] bg-white p-2 shadow-pop sm:-left-8 sm:w-[140px]"
      >
        <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-navy-100">
          <img src={avatars[3].src} alt="" className="size-full object-cover" />
          <span className="absolute inset-x-[18%] top-[14%] bottom-[22%] rounded-[50%] border-2 border-white/90 shadow-[0_0_0_999px_rgb(2_14_57/0.28)]" />
          {phase === 'scan' && <span className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent to-cyan-300/60" />}
        </div>
        <div className="flex items-center gap-1.5 px-1 pt-2 pb-0.5 text-[11px] font-medium text-navy-800">
          <ScanFace className="size-3.5 text-brand-600" />
          {phase === 'scan' ? 'Reading your face' : 'Face matched'}
        </div>
      </motion.div>
    </div>
  )
}
