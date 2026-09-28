import { CalendarPlus, Check, Download, FolderUp, Link2, Users } from 'lucide-react'
import { motion, useScroll, useSpring } from 'motion/react'
import { useRef } from 'react'
import { byIds, thumb } from '../../data/gallery'
import { cn } from '../../lib/utils'
import Photo from '../Photo'
import DriveIcon from '../ui/DriveIcon'
import { Avatar } from '../ui/primitives'

const STEPS = [
  [CalendarPlus, 'Create your events', 'Name, date, place and a cover. Run as many events as you like, each with its own private link.'],
  [FolderUp, 'Bring the photos', 'Drop in a whole folder from the shoot, or paste a Google Drive link. Every face is found and indexed.'],
  [Link2, 'Share one link', 'On the invite, a QR code at the venue, or the group chat. Guests open it and take a selfie.'],
  [Users, 'See who found themselves', 'Every search comes with the guest’s name and email. Export the list any time.'],
]

// Aceternity "Tracing Beam", laid out horizontally: the line fills as the
// steps scroll into view (vertical on phones).
function Steps() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 55%'] })
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  return (
    <ol ref={ref} className="relative grid gap-10 md:grid-cols-4 md:gap-6">
      <span aria-hidden className="absolute top-[22px] right-[12%] left-[12%] hidden h-px bg-white/10 md:block" />
      <motion.span aria-hidden className="absolute top-[22px] right-[12%] left-[12%] hidden h-px origin-left bg-gradient-to-r from-cyan-300 via-brand-400 to-brand-600 md:block" style={{ scaleX: fill }} />
      <span aria-hidden className="absolute top-2 bottom-2 left-[21px] w-px bg-white/10 md:hidden" />
      <motion.span aria-hidden className="absolute top-2 bottom-2 left-[21px] w-px origin-top bg-gradient-to-b from-cyan-300 to-brand-600 md:hidden" style={{ scaleY: fill }} />
      {STEPS.map(([Icon, title, text], i) => (
        <motion.li
          key={title}
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, delay: i * 0.08 }}
          className="relative flex gap-5 md:flex-col md:items-center md:gap-4 md:text-center"
        >
          <span className="relative z-10 grid size-11 shrink-0 place-items-center rounded-2xl bg-navy-900 text-cyan-300 shadow-[0_0_0_6px_#020e39] ring-1 ring-white/15">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="font-serif text-[15px] text-cyan-300 italic">Step {i + 1}</p>
            <h3 className="mt-0.5 text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1.5 text-[15px] leading-relaxed text-navy-300">{text}</p>
          </div>
        </motion.li>
      ))}
    </ol>
  )
}

const VISITORS = [
  ['Priya Sharma', 'priya@example.com', 38, '2 min ago'],
  ['Rahul Mehta', 'rahul.m@example.com', 21, '9 min ago'],
  ['Ananya Rao', 'ananya@example.com', 44, '23 min ago'],
]

// A slice of the organizer console: photos coming in from Drive, then who searched.
function ConsoleMock() {
  const photos = byIds(['JjOm8445mXw', '8vmvtj_W4xQ', 'dHQf0wGQTzk', 'mJzQAjnleKs', 'tYPkWLWVVOo', 'PNXx2A5s5Zk']).map(thumb)
  return (
    <div className="relative min-w-0">
      <div aria-hidden className="absolute -inset-8 rounded-[48px] bg-brand-600/25 blur-3xl" />
      <div className="relative grid gap-3 rounded-[28px] bg-white/[0.04] p-3 ring-1 ring-white/10 backdrop-blur sm:p-4 [&>*]:min-w-0">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-2xl bg-navy-900/80 p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-white">
              <DriveIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">Sarah-Arjun-Wedding-Final</p>
              <p className="text-[12px] text-navy-300">Google Drive · 1,248 photos · 3 subfolders</p>
            </div>
            <span className="shrink-0 rounded-full bg-cyan-300/15 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-cyan-300">Indexing</span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-cyan-300" initial={{ width: '6%' }} whileInView={{ width: '82%' }} viewport={{ once: true }} transition={{ duration: 2.4, ease: 'easeOut' }} />
          </div>
          <div className="mt-3 grid grid-cols-6 gap-1.5">
            {photos.map((p, i) => (
              <motion.div key={p.id} className="relative" initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.3 + i * 0.12 }}>
                <Photo photo={p} className="aspect-square rounded-lg" />
                {i < 4 && (
                  <span className="absolute right-1 bottom-1 grid size-4 place-items-center rounded-full bg-ok text-white">
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 }} className="overflow-hidden rounded-2xl bg-white text-navy-900">
          <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Users className="size-4 text-brand-600" /> Visitors
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">214</span>
            </p>
            <span className="inline-flex items-center gap-1 rounded-lg bg-navy-50 px-2.5 py-1 text-[12px] font-medium text-navy-600">
              <Download className="size-3" /> Export CSV
            </span>
          </div>
          <ul className="divide-y divide-navy-100">
            {VISITORS.map(([name, email, n, when], i) => (
              <motion.li key={email} initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.35 + i * 0.1 }} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar user={{ name }} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{name}</p>
                  <p className="truncate text-[12px] text-navy-500">{email}</p>
                </div>
                <span className="text-right">
                  <span className="block text-[13px] font-semibold tabular-nums">{n} photos</span>
                  <span className={cn('block text-[11px]', i === 0 ? 'text-ok' : 'text-navy-400')}>{when}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </div>
  )
}

// Heading (children) + console side by side, then the four steps across.
export default function OrganizerSection({ children }) {
  return (
    <div className="grid min-w-0 gap-20 [&>*]:min-w-0">
      {/* min-w-0: long, non-wrapping names inside mustn't widen the columns on phones */}
      <div className="grid items-center gap-14 lg:grid-cols-[1fr_1.05fr] lg:gap-20 [&>*]:min-w-0">
        <div>{children}</div>
        <ConsoleMock />
      </div>
      <Steps />
    </div>
  )
}
