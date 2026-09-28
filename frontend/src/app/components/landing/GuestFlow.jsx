import { ArrowRight, Check, Download, Search } from 'lucide-react'
import { AnimatePresence, motion, useInView } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { byIds, largestFace, selfie, thumb } from '../../data/gallery'
import { cn } from '../../lib/utils'
import Photo from '../Photo'

// "How it works" for guests: the steps scroll on the left while a phone on
// the right (sticky) shows the matching screen. On small screens each step
// carries its own phone.

const EVENTS = [
  ['8vmvtj_W4xQ', 'Sarah & Arjun’s Wedding', '21 Sep · Mumbai'],
  ['3EMw3T-ZjkE', 'Convocation 2026', '14 Sep · Pune'],
  ['CnAgA4rmGUQ', 'Product Summit', '02 Sep · Bengaluru'],
]
const RESULTS = ['DVmEj6ptFbc', 'LO1lToLGGFA', 'QbGPGsliC5w', 'ee9plLQf41E', 'zc6ezUR4-8I', '0O26oGDg-Hg']

function StatusBar({ dark }) {
  return (
    <div className={cn('flex items-center justify-between px-6 pt-3 text-[11px] font-semibold', dark ? 'text-white' : 'text-navy-950')}>
      <span>9:41</span>
      <span className="h-[18px] w-20 rounded-full bg-navy-950" />
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn('w-[3px] rounded-sm', dark ? 'bg-white' : 'bg-navy-950')} style={{ height: 5 + i * 2 }} />
        ))}
      </span>
    </div>
  )
}

function EventsScreen() {
  const events = byIds(EVENTS.map((e) => e[0])).map(thumb)
  return (
    <div className="flex h-full flex-col bg-canvas">
      <StatusBar />
      <div className="px-5 pt-6">
        <p className="text-[11px] font-medium text-brand-700">Good evening</p>
        <p className="mt-1 font-display text-[22px] leading-tight font-semibold text-navy-950">Find your moments.</p>
        <div className="mt-4 flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-[12px] text-navy-400 ring-1 ring-navy-100">
          <Search className="size-3.5" /> Search events
        </div>
      </div>
      <div className="mt-4 grid gap-2.5 px-4">
        {events.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, scale: i === 0 ? [1, 1, 0.97, 1] : 1 }}
            transition={{ delay: 0.1 + i * 0.08, scale: { delay: 1.1, duration: 0.5 } }}
            className={cn('overflow-hidden rounded-2xl bg-white ring-1', i === 0 ? 'shadow-lift ring-brand-300' : 'ring-navy-100')}
          >
            <Photo photo={p} className="h-20" />
            <div className="flex items-center gap-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-navy-950">{EVENTS[i][1]}</p>
                <p className="text-[11px] text-navy-500">{EVENTS[i][2]}</p>
              </div>
              {i === 0 && (
                <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-white">
                  <ArrowRight className="size-3.5" />
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// The live camera: the photo fills the screen (9:16 on a 9:19 screen, so only
// the sides crop) and the oval sits where her face is, 17-53% down.
function SelfieScreen() {
  return (
    <div className="relative h-full overflow-hidden bg-navy-950">
      <img src={selfie.src} alt="" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-x-0 top-0">
        <StatusBar dark />
      </div>
      {/* face oval: everything outside it is dimmed, a scan line sweeps inside */}
      <div className="absolute top-[17%] left-1/2 h-[36%] -translate-x-1/2 overflow-hidden rounded-[50%] ring-2 ring-cyan-300 shadow-[0_0_0_999px_rgb(2_14_57/0.55),0_0_40px_rgb(5_176_246/0.55)]" style={{ aspectRatio: '3 / 4' }}>
        <span className="absolute inset-x-0 top-0 h-1/3 animate-scan">
          <span className="absolute inset-0 bg-gradient-to-b from-transparent to-cyan-300/25" />
          <span className="absolute inset-x-0 bottom-0 h-px bg-cyan-200 shadow-[0_0_12px_2px_rgb(5_176_246/0.8)]" />
        </span>
      </div>
      {/* the name + email the guest gave before the camera opened */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="absolute top-[8.5%] left-1/2 flex max-w-[88%] -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/15 py-1 pr-3 pl-1 text-[11px] whitespace-nowrap text-white ring-1 ring-white/20 backdrop-blur-md"
      >
        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-ok">
          <Check className="size-3" strokeWidth={3} />
        </span>
        <span className="truncate">
          <span className="font-semibold">Priya Sharma</span> · priya@example.com
        </span>
      </motion.div>
      <p className="absolute inset-x-0 top-[57%] text-center text-[13px] font-medium text-white">Hold still… finding your face</p>
      <div className="absolute inset-x-0 bottom-[5%] flex justify-center">
        <span className="grid size-16 place-items-center rounded-full ring-4 ring-white/80">
          <span className="size-12 rounded-full bg-white" />
        </span>
      </div>
    </div>
  )
}

function ResultsScreen() {
  const photos = byIds(RESULTS).map(thumb)
  const cols = [photos.filter((_, i) => i % 2 === 0), photos.filter((_, i) => i % 2 === 1)]
  return (
    <div className="relative flex h-full flex-col bg-white">
      <StatusBar />
      <div className="px-5 pt-5">
        <p className="text-[11px] font-medium text-brand-700">Sarah & Arjun’s Wedding</p>
        <p className="mt-1 font-display text-[20px] leading-tight font-semibold text-navy-950">
          We found <span className="font-serif text-[24px] font-normal text-brand-600 italic">38 moments</span> for you.
        </p>
      </div>
      <div className="mt-3 grid flex-1 grid-cols-2 gap-1.5 overflow-hidden px-3">
        {cols.map((col, c) => (
          <div key={c} className="grid content-start gap-1.5">
            {col.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + (i * 2 + c) * 0.08 }}>
                <Photo photo={p} ratio="natural" face={largestFace(p)} faceDelay={0.5 + (i * 2 + c) * 0.08} className="rounded-lg" />
              </motion.div>
            ))}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white via-white to-transparent px-4 pt-10 pb-5">
        <span className="flex h-11 items-center justify-center gap-2 rounded-xl bg-brand-600 text-[13px] font-semibold text-white">
          <Download className="size-4" /> Download all 38
        </span>
      </div>
    </div>
  )
}

const STEPS = [
  {
    title: 'Pick your event',
    text: 'Open the link the organizer shared, or choose the event from the list. Your search only ever looks inside that one event.',
    Screen: EventsScreen,
  },
  {
    title: 'Say hi, then take a selfie',
    text: 'Type your name and email so the organizer knows who searched. Then look at the camera, or upload a photo you already have. No app, no account, no password.',
    Screen: SelfieScreen,
  },
  {
    title: 'Get every photo you’re in',
    text: 'Seconds later, every photo with your face, best matches first. Download them one by one, or all at once.',
    Screen: ResultsScreen,
  },
]

function Phone({ children, className }) {
  return (
    <div className={cn('rounded-[46px] bg-navy-950 p-2.5 shadow-[0_40px_80px_-30px_rgb(2_14_57/0.55)] ring-1 ring-navy-800', className)}>
      <div className="relative aspect-[9/19] overflow-hidden rounded-[38px] bg-white">{children}</div>
    </div>
  )
}

function Step({ i, step, onActive }) {
  const ref = useRef(null)
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' })
  useEffect(() => {
    if (inView) onActive(i)
  }, [inView, i, onActive])
  return (
    <div ref={ref} className="grid gap-8 lg:min-h-[78vh] lg:content-center">
      <div className="max-w-md">
        <span className="font-serif text-6xl leading-none text-brand-600 italic">{String(i + 1).padStart(2, '0')}</span>
        <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight text-navy-950 sm:text-4xl">{step.title}</h3>
        <p className="mt-4 text-lg leading-relaxed text-navy-500">{step.text}</p>
      </div>
      <Phone className="mx-auto w-full max-w-[280px] lg:hidden">
        <step.Screen />
      </Phone>
    </div>
  )
}

export default function GuestFlow() {
  const [active, setActive] = useState(0)
  const Screen = STEPS[active].Screen
  return (
    <div className="grid gap-20 lg:grid-cols-[1fr_minmax(0,380px)] lg:gap-16">
      <div className="grid gap-24 lg:gap-0">
        {STEPS.map((s, i) => (
          <Step key={s.title} i={i} step={s} onActive={setActive} />
        ))}
      </div>
      <div className="relative hidden lg:block">
        <div className="sticky top-[calc(50vh-330px)]">
          <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-gradient-to-br from-brand-200/60 via-cyan-100/50 to-transparent blur-3xl" />
          <Phone className="w-[320px]">
            <AnimatePresence mode="wait">
              <motion.div key={active} className="absolute inset-0" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
                <Screen />
              </motion.div>
            </AnimatePresence>
          </Phone>
          <div className="mt-6 flex justify-center gap-2">
            {STEPS.map((s, i) => (
              <span key={s.title} className={cn('h-1.5 rounded-full transition-all duration-500', i === active ? 'w-8 bg-brand-600' : 'w-1.5 bg-navy-200')} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
