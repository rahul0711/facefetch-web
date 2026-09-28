import {
  ArrowRight,
  Briefcase,
  Cake,
  Camera,
  Check,
  ChevronDown,
  CloudUpload,
  Download,
  GraduationCap,
  Heart,
  Link2,
  Lock,
  Mic,
  Music,
  PartyPopper,
  ScanFace,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trophy,
  UserPlus,
  Zap,
} from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { GridBackdrop, Marquee, Reveal, Spotlight } from '../../components/effects'
import HeroVisual from '../../components/landing/HeroVisual'
import Photo from '../../components/Photo'
import Button from '../../components/ui/Button'
import { avatars, pick, pool } from '../../data/gallery'
import { PixelCluster } from '../../components/ui/Logo'
import { useDocumentTitle } from '../../lib/hooks'
import { cn } from '../../lib/utils'
import { ROLE_HOME } from '../../services/authService'

function SectionHeading({ eyebrow, title, children, center = true, dark }) {
  return (
    <Reveal className={cn('max-w-2xl', center && 'mx-auto text-center')}>
      <p className={cn('inline-flex items-center gap-2 text-sm font-semibold', dark ? 'text-cyan-300' : 'text-brand-700')}>
        {/* the logo's pixel square as a quiet brand bullet */}
        <span aria-hidden className={cn('size-2', dark ? 'bg-cyan-400' : 'bg-gradient-to-br from-brand-600 to-cyan-500')} />
        {eyebrow}
      </p>
      <h2 className={cn('mt-3 text-3xl font-semibold sm:text-[44px] sm:leading-[1.08]', dark ? 'text-white' : 'text-navy-950')}>{title}</h2>
      {children && <p className={cn('mt-4 text-lg leading-relaxed', dark ? 'text-navy-300' : 'text-navy-500')}>{children}</p>}
    </Reveal>
  )
}

// ------------------------------------------------------------------- hero

function Hero({ primaryTo }) {
  return (
    <section className="relative overflow-hidden bg-navy-950 pt-28 pb-24 sm:pt-36 lg:pb-32">
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" />
      <GridBackdrop dark />
      {/* the Genesis Hub arc, sweeping behind the hero */}
      <svg aria-hidden viewBox="0 0 1440 700" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] w-full opacity-60">
        <defs>
          <linearGradient id="hero-arc" x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#0550bc" stopOpacity="0" />
            <stop offset="0.45" stopColor="#0769ee" stopOpacity="0.55" />
            <stop offset="1" stopColor="#05b0f6" stopOpacity="0.9" />
          </linearGradient>
        </defs>
        <path d="M-40 690C260 360 760 170 1480 250" fill="none" stroke="url(#hero-arc)" strokeWidth="2" />
        <path d="M-40 700C300 400 800 230 1480 320" fill="none" stroke="url(#hero-arc)" strokeWidth="1" opacity="0.5" />
      </svg>
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-navy-950" />
      <div className="container-page relative grid items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
        <div className="max-lg:text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full bg-white/5 py-1 pr-3 pl-1 text-[13px] text-navy-200 ring-1 ring-white/10"
          >
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">New</span>
            AI face search for event photos
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 text-[40px] leading-[1.05] font-bold tracking-[-0.035em] text-white sm:text-[56px] lg:text-[60px] xl:text-[66px]"
          >
            Find every moment <span className="text-gradient-brand">you’re in.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 max-w-xl text-lg leading-relaxed text-navy-300 max-lg:mx-auto sm:text-xl"
          >
            Thousands of event photos. One selfie. Every memory that matters, found in seconds instead of hours of scrolling.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="mt-9 flex flex-wrap gap-3 max-lg:justify-center"
          >
            <Button to={primaryTo} size="xl" className="shadow-[0_8px_30px_-6px_rgb(7_105_238/0.7)]">
              <Camera /> Find My Photos
            </Button>
            <Button href="#how" size="xl" variant="glass">
              See How It Works
            </Button>
          </motion.div>
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-sm text-navy-300 max-lg:justify-center"
          >
            {['No app to install', 'Works on any phone', 'Your selfie isn’t shared'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 text-cyan-300" /> {t}
              </li>
            ))}
          </motion.ul>
        </div>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.8 }} className="relative pb-6 lg:pl-6">
          {/* the logo's trailing pixels, peeking out of the photo wall */}
          <PixelCluster dark className="absolute -top-9 -right-3 z-10 size-12 max-sm:hidden" />
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  )
}

// -------------------------------------------------------------- event types

const EVENT_TYPES = [
  [Heart, 'Weddings'],
  [Mic, 'Conferences'],
  [GraduationCap, 'College fests'],
  [Briefcase, 'Corporate offsites'],
  [Music, 'Concerts & festivals'],
  [Trophy, 'Sports'],
  [Cake, 'Birthdays'],
  [PartyPopper, 'Parties'],
  [Camera, 'Photography studios'],
]

function TrustStrip() {
  return (
    <section className="border-b border-navy-100 bg-white py-10" aria-label="Event types">
      <p className="mb-6 text-center text-sm font-medium text-navy-500">Built for every event where the camera never stops</p>
      <Marquee duration={45}>
        {EVENT_TYPES.map(([Icon, label]) => (
          <span key={label} className="flex items-center gap-2.5 rounded-full border border-navy-100 bg-navy-50/60 px-5 py-2.5 text-[15px] font-medium whitespace-nowrap text-navy-700">
            <Icon className="size-4 text-brand-600" /> {label}
          </span>
        ))}
      </Marquee>
    </section>
  )
}

// ------------------------------------------------------------ how it works

function HowItWorks() {
  const wedding = pool('wedding')
  const steps = [
    {
      n: '01',
      title: 'Choose your event',
      text: 'Open the event you attended. You only ever search the photos from that event.',
      visual: (
        <div className="grid gap-2">
          {[wedding[0], pool('techfest')[2]].map((p, i) => (
            <div key={p.id} className={cn('flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-navy-100', i === 0 && 'shadow-lift ring-brand-200')}>
              <Photo photo={p} className="size-11 shrink-0 rounded-lg" />
              <div className="min-w-0 text-left">
                <div className="truncate text-[13px] font-semibold text-navy-900">{i === 0 ? 'Sarah & Arjun Wedding' : 'TechFest 2026'}</div>
                <div className="text-[11px] text-navy-500">{i === 0 ? '21 Sep · Mumbai' : '18 Sep · Ahmedabad'}</div>
              </div>
              {i === 0 && <ArrowRight className="ml-auto size-4 shrink-0 text-brand-600" />}
            </div>
          ))}
        </div>
      ),
    },
    {
      n: '02',
      title: 'Take a selfie',
      text: 'Hold up your phone, or upload a photo you like. It takes about three seconds.',
      visual: (
        <div className="mx-auto w-28 rounded-[20px] bg-navy-950 p-1.5 shadow-lift">
          <div className="relative aspect-[9/16] overflow-hidden rounded-[15px]">
            <img src={avatars[4].src} alt="" className="size-full object-cover" />
            <span className="absolute inset-x-[16%] top-[18%] bottom-[30%] rounded-[50%] border-2 border-cyan-300 shadow-[0_0_0_999px_rgb(2_14_57/0.4)]" />
            <span className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent to-cyan-300/50" />
          </div>
        </div>
      ),
    },
    {
      n: '03',
      title: 'Get your moments',
      text: 'Every photo you’re in, best matches first. Favorite, download or share them.',
      visual: (
        <div className="grid grid-cols-3 gap-1.5">
          {wedding.slice(3, 9).map((p) => (
            <Photo key={p.id} photo={p} className="aspect-square rounded-lg" />
          ))}
        </div>
      ),
    },
  ]
  return (
    <section id="how" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading eyebrow="How it works" title="Three steps. No scrolling.">
          Guests find their photos without an app, a hashtag, or a 2,000-photo shared folder.
        </SectionHeading>
        <ol className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <li className="flex h-full flex-col rounded-3xl border border-navy-100 bg-gradient-to-b from-navy-50/80 to-white p-6">
                <div className="grid h-44 place-items-center rounded-2xl bg-navy-50 p-4 ring-1 ring-navy-100/80">
                  <div className="w-full max-w-[240px]">{s.visual}</div>
                </div>
                <div className="mt-6 font-mono text-sm font-medium text-brand-600">{s.n}</div>
                <h3 className="mt-1 text-xl font-semibold text-navy-950">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-navy-500">{s.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ----------------------------------------------------------- before/after

function BeforeAfter() {
  const all = [...pool('wedding'), ...pool('party'), ...pool('collegefest'), ...pool('summit')]
  const found = pick([
    ['wedding', 1],
    ['wedding', 4],
    ['party', 5],
    ['wedding', 10],
    ['party', 8],
    ['wedding', 13],
  ])
  return (
    <section className="bg-canvas py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading eyebrow="The old way vs. Genesis Hub" title="Stop scrolling through thousands of photos." />
        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="relative h-full overflow-hidden rounded-3xl border border-navy-100 bg-white p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-navy-100 px-3 py-1 text-[13px] font-medium text-navy-600">Before</span>
                <span className="text-sm text-navy-400 tabular-nums">Photo 1,284 of 2,000</span>
              </div>
              <h3 className="mt-5 text-2xl font-semibold text-navy-950">Hours of scrolling</h3>
              <p className="mt-2 text-navy-500">A shared drive with 2,000 photos. You zoom into every group shot, hoping to spot yourself.</p>
              <div className="relative mt-6 grid grid-cols-8 gap-1 opacity-70 grayscale-[35%]" aria-hidden>
                {Array.from({ length: 48 }, (_, i) => all[(i * 7) % all.length]).map((p, i) => (
                  <img key={i} src={p.src} alt="" loading="lazy" className="aspect-square w-full rounded-[4px] object-cover" />
                ))}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/30 to-white" />
              </div>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="relative h-full overflow-hidden rounded-3xl bg-navy-950 p-6 text-white sm:p-8">
              <GridBackdrop dark />
              <div className="relative flex items-center justify-between">
                <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-[13px] font-medium text-cyan-300 ring-1 ring-cyan-300/30">With Genesis Hub</span>
                <span className="text-sm text-navy-300 tabular-nums">2.8 seconds</span>
              </div>
              <h3 className="relative mt-5 text-2xl font-semibold">47 photos, found for you</h3>
              <p className="relative mt-2 text-navy-300">One selfie. Genesis Hub checks every face in every photo and brings back only the ones you’re in.</p>
              <div className="relative mt-6 grid grid-cols-3 gap-2">
                {found.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.15 + i * 0.07 }}
                  >
                    <Photo photo={p} className="aspect-[4/3] rounded-xl ring-1 ring-white/10" />
                  </motion.div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- occasions

function Occasions() {
  const cards = [
    { label: 'Weddings', text: 'Every guest, every ritual, every dance.', photo: pool('wedding')[6], span: 'md:col-span-2 md:row-span-2' },
    { label: 'Conferences', text: 'Speakers and attendees find their stage moments.', photo: pool('summit')[4] },
    { label: 'College events', text: 'Fests, convocations and hackathons.', photo: pool('collegefest')[14] },
    { label: 'Corporate events', text: 'Offsites, awards and team dinners.', photo: pool('corporate')[5] },
    { label: 'Parties', text: 'Birthdays, rooftops and celebrations.', photo: pool('party')[4] },
    { label: 'Festivals', text: 'Find yourself in a crowd of 12,000.', photo: pool('music')[1] },
    { label: 'Sports', text: 'Players, fans and every goal.', photo: pool('sports')[1] },
    { label: 'Photography studios', text: 'Deliver galleries clients actually use.', photo: pool('startup')[3], span: 'col-span-2' },
  ]
  return (
    <section className="bg-white py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading eyebrow="Event types" title="Made for every occasion." />
        <div className="mt-14 grid auto-rows-[190px] grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal key={c.label} delay={(i % 4) * 0.05} className={cn('group relative overflow-hidden rounded-2xl sm:rounded-3xl', c.span, i === 0 && 'col-span-2 row-span-2')}>
              <Photo photo={c.photo} className="absolute inset-0" imgClassName="transition-transform duration-700 group-hover:scale-[1.04]" />
              <div className="absolute inset-0 bg-gradient-to-t from-navy-950/85 via-navy-950/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                <h3 className={cn('font-semibold text-white', i === 0 ? 'text-2xl' : 'text-lg')}>{c.label}</h3>
                <p className="mt-0.5 text-[13px] text-white/75 max-sm:hidden">{c.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ----------------------------------------------------------------- features

const FEATURES = [
  { icon: ScanFace, title: 'AI face search', text: 'State-of-the-art face recognition (SCRFD detection + AdaFace) checks every face, even in the back row.' },
  { icon: Zap, title: 'Results in seconds', text: 'Thousands of photos compared faster than you can open the first album.' },
  { icon: ShieldCheck, title: 'Private by design', text: 'Search happens inside one event. Your selfie is used for your search, not for anything else.' },
  { icon: Smartphone, title: 'Works on mobile', text: 'Built phone-first. Front or back camera, or upload a photo you already have.' },
  { icon: Download, title: 'Download your memories', text: 'Full-quality originals, one at a time or all at once.' },
  { icon: Search, title: 'No manual searching', text: 'No hashtags, no bib numbers, no folders to dig through.' },
]

function Features() {
  return (
    <section id="features" className="scroll-mt-16 bg-canvas py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading eyebrow="Features" title="Everything guests need. Nothing they don’t." />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={(i % 3) * 0.06}>
              <div className="group h-full rounded-2xl border border-navy-100 bg-white p-6 transition-shadow duration-300 hover:shadow-lift">
                <span className="grid size-11 place-items-center rounded-xl bg-navy-950 text-cyan-300 transition-transform duration-300 group-hover:-rotate-6">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-navy-950">{title}</h3>
                <p className="mt-1.5 leading-relaxed text-navy-500">{text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ----------------------------------------------------------- product preview

function ProductPreview() {
  const results = pool('wedding')
  const matched = [1, 4, 6, 9, 10, 13, 15, 17].map((i) => results[i]).filter(Boolean)
  return (
    <section className="relative overflow-hidden bg-navy-950 py-24 sm:py-32">
      <Spotlight className="-top-60 left-1/2 md:-top-40" fill="#05b0f6" />
      <div className="container-page relative">
        <SectionHeading dark eyebrow="The moment" title="“We found 38 moments for you.”">
          The best part of any event, delivered to every guest. Big, beautiful photos with no clutter.
        </SectionHeading>
        <Reveal className="relative mx-auto mt-14 max-w-5xl">
          <div className="overflow-hidden rounded-2xl bg-white shadow-pop ring-1 ring-white/10">
            <div className="flex items-center gap-2 border-b border-navy-100 bg-navy-50 px-4 py-3">
              <span className="flex gap-1.5">
                {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
                  <span key={c} className="size-3 rounded-full" style={{ background: c }} />
                ))}
              </span>
              <span className="mx-auto rounded-md bg-white px-3 py-1 text-xs text-navy-500 ring-1 ring-navy-100">genesishub.app/e/sarah-arjun-wedding</span>
            </div>
            <div className="p-5 sm:p-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-brand-600">Sarah &amp; Arjun Wedding</p>
                  <h3 className="mt-1 text-2xl font-semibold text-navy-950 sm:text-3xl">We found 38 moments for you.</h3>
                </div>
                <span className="flex gap-2 max-sm:hidden">
                  <span className="rounded-lg bg-navy-100 px-3 py-2 text-[13px] font-medium text-navy-700">Favorite all</span>
                  <span className="rounded-lg bg-brand-600 px-3 py-2 text-[13px] font-medium text-white">Download all</span>
                </span>
              </div>
              <div className="mt-6 columns-2 gap-3 sm:columns-4 [&>*]:mb-3">
                {matched.map((p) => (
                  <div key={p.id} className="break-inside-avoid overflow-hidden rounded-xl">
                    <Photo photo={p} ratio="natural" />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* phone */}
          <div className="absolute -right-2 -bottom-10 hidden w-[200px] rounded-[32px] bg-navy-900 p-2 shadow-pop ring-1 ring-white/15 md:block lg:-right-10">
            <div className="overflow-hidden rounded-[26px] bg-white">
              <div className="p-3">
                <p className="text-[10px] font-medium text-brand-600">Your moments</p>
                <p className="text-[13px] font-semibold text-navy-950">38 photos found</p>
              </div>
              <div className="grid grid-cols-2 gap-1 px-1 pb-1">
                {matched.slice(0, 6).map((p) => (
                  <Photo key={p.id} photo={p} className="aspect-square rounded-md" />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- organizers

function Organizers() {
  const steps = [
    { icon: Sparkles, title: 'Create your event', text: 'Name, date, venue and cover. Your event gets its own private gallery.' },
    { icon: UserPlus, title: 'Invite your team', text: 'Give photographers event-level access: they only see the events you assign.' },
    { icon: CloudUpload, title: 'Upload the photos', text: 'Drag in thousands of photos. Every face is detected and indexed automatically.' },
    { icon: Link2, title: 'Share one link', text: 'Guests open the link, take a selfie and find themselves. No more “can you send me that one?”' },
  ]
  return (
    <section id="organizers" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="container-page grid gap-14 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <SectionHeading center={false} eyebrow="For organizers & photographers" title="Deliver photos guests actually find.">
            Genesis Hub turns a folder of thousands of photos into a personal gallery for every guest, with the controls
            organizers and studios need.
          </SectionHeading>
          <Reveal className="mt-8 flex flex-wrap gap-3">
            <Button to="/login" size="lg">
              Admin login <ArrowRight />
            </Button>
          </Reveal>
        </div>
        <ol className="relative grid gap-4">
          <span aria-hidden className="absolute top-8 bottom-8 left-[27px] w-px bg-gradient-to-b from-brand-200 via-brand-400 to-cyan-300" />
          {steps.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 0.07}>
              <li className="relative flex gap-5 rounded-2xl border border-navy-100 bg-white p-5 shadow-card">
                <span className="relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl bg-navy-950 text-cyan-300">
                  <Icon className="size-6" />
                </span>
                <div>
                  <h3 className="font-semibold text-navy-950">
                    <span className="mr-2 font-mono text-sm text-brand-600">0{i + 1}</span>
                    {title}
                  </h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-navy-500">{text}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ privacy

function Privacy() {
  const points = [
    ['Search stays inside one event', 'A selfie searches only the event you choose. Photos from other events are never shown.'],
    ['Your selfie is used for your search', 'It’s turned into a face signature to find your photos. It isn’t added to any gallery.'],
    ['Organizers control access', 'Only invited guests and assigned admins can open an event.'],
    ['You stay in control', 'Remove your account and search history at any time from your profile.'],
  ]
  return (
    <section id="privacy" className="scroll-mt-16 bg-canvas py-24 sm:py-32">
      <div className="container-page grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <span className="grid size-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-lift ring-1 ring-navy-100">
            <Lock className="size-6" />
          </span>
          <SectionHeading center={false} eyebrow="Privacy" title="Face search, handled with care.">
            Face data is biometric data. We treat it that way, with plain-language consent before every first search.
          </SectionHeading>
          <Reveal className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium">
            <Link to="/privacy" className="text-brand-700 hover:underline">
              Privacy Policy →
            </Link>
            <Link to="/consent" className="text-brand-700 hover:underline">
              Biometric consent →
            </Link>
          </Reveal>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {points.map(([t, d], i) => (
            <Reveal key={t} delay={i * 0.06}>
              <div className="h-full rounded-2xl border border-navy-100 bg-white p-6">
                <ShieldCheck className="size-5 text-brand-600" />
                <h3 className="mt-4 font-semibold text-navy-950">{t}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-navy-500">{d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------- FAQ

const FAQS = [
  ['Do I need to install an app?', 'No. Genesis Hub runs in your phone’s browser. Open the event link, take a selfie, and you’re done.'],
  ['What if the camera doesn’t work?', 'You can upload any clear photo of yourself instead. A front-facing photo in good light works best.'],
  ['How accurate is it?', 'Very accurate for clear faces. Very small, blurry or turned-away faces are skipped rather than guessed, so you won’t get strangers in your results.'],
  ['Can other guests see my photos?', 'Guests only see the photos their own face matches. Event galleries are only visible to invited guests and the event’s admins.'],
  ['Is my selfie stored?', 'Your selfie is used to run your search in the event you picked. It is not added to the event gallery or shared with other guests.'],
  ['How do organizers get started?', 'Create an event, assign your photographers, upload the photos, and share the link with guests.'],
]

function FAQ() {
  return (
    <section id="faq" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="container-page max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Questions, answered." />
        <div className="mt-12 divide-y divide-navy-100 border-y border-navy-100">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-lg py-4 text-left text-[17px] font-medium text-navy-950 [&::-webkit-details-marker]:hidden">
                {q}
                <ChevronDown className="size-5 shrink-0 text-navy-400 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <p className="pb-5 leading-relaxed text-navy-500">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------- CTA

function FinalCta({ primaryTo }) {
  const strip = [...pool('wedding').slice(0, 5), ...pool('party').slice(4, 9), ...pool('collegefest').slice(10, 15)]
  return (
    <section className="bg-white px-4 pb-24 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[32px] bg-navy-950 px-6 py-20 text-center sm:px-12 sm:py-24">
        <div aria-hidden className="absolute inset-0 opacity-25">
          <Marquee duration={70} gap="0.75rem" className="absolute top-6">
            {strip.map((p) => (
              <img key={p.id} src={p.src} alt="" loading="lazy" className="h-28 w-40 rounded-xl object-cover" />
            ))}
          </Marquee>
        </div>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-navy-950/30 via-navy-950/85 to-navy-950" />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl text-3xl font-semibold text-white sm:text-5xl sm:leading-[1.08]">
            Your next event has thousands of moments. <span className="text-gradient-brand">Let your guests find theirs.</span>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button to={primaryTo} size="xl" variant="light">
              Get Started <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function Landing() {
  useDocumentTitle()
  const { user } = useAuth()
  const primaryTo = user ? ROLE_HOME[user.role] : '/signup'
  return (
    <>
      <Hero primaryTo={primaryTo} />
      <TrustStrip />
      <HowItWorks />
      <BeforeAfter />
      <Occasions />
      <Features />
      <ProductPreview />
      <Organizers />
      <Privacy />
      <FAQ />
      <FinalCta primaryTo={primaryTo} />
    </>
  )
}
