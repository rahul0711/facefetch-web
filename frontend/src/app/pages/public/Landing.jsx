import { ArrowDown, ArrowRight, Camera, EyeOff, Lock, Plus, ScanFace, ShieldCheck, UserRound } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { GridBackdrop, Marquee, Reveal } from '../../components/effects'
import CompareSlider from '../../components/landing/CompareSlider'
import FeatureBento from '../../components/landing/FeatureBento'
import GuestFlow from '../../components/landing/GuestFlow'
import MatchWall from '../../components/landing/MatchWall'
import OrganizerSection from '../../components/landing/OrganizerSection'
import ShineButton from '../../components/landing/ShineButton'
import Photo from '../../components/Photo'
import { byIds, largestFace, selfie, thumb } from '../../data/gallery'
import { useDocumentTitle } from '../../lib/hooks'
import { cn } from '../../lib/utils'
import { ROLE_HOME } from '../../services/authService'

const EASE = [0.22, 1, 0.36, 1]

function SectionHeading({ eyebrow, title, accent, children, center = true, dark, className }) {
  return (
    <Reveal className={cn('max-w-2xl', center && 'mx-auto text-center', className)}>
      <p className={cn('inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.14em] uppercase', dark ? 'text-cyan-300' : 'text-brand-700')}>
        {/* the logo's pixel square as a quiet brand bullet */}
        <span aria-hidden className={cn('size-1.5', dark ? 'bg-cyan-300' : 'bg-brand-600')} />
        {eyebrow}
      </p>
      <h2 className={cn('mt-4 text-[34px] leading-[1.05] font-semibold tracking-[-0.03em] sm:text-5xl', dark ? 'text-white' : 'text-navy-950')}>
        {title}
        {accent && <span className={cn('font-serif font-normal tracking-normal italic', dark ? 'text-cyan-300' : 'text-brand-600')}> {accent}</span>}
      </h2>
      {children && <p className={cn('mt-5 text-lg leading-relaxed', dark ? 'text-navy-300' : 'text-navy-500')}>{children}</p>}
    </Reveal>
  )
}

// -------------------------------------------------------------------- hero

function FoundToast() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 1.4, duration: 0.8, ease: EASE }}
      className="absolute right-8 bottom-12 z-10 hidden items-center gap-4 rounded-3xl bg-white/10 py-3 pr-6 pl-3 ring-1 ring-white/20 backdrop-blur-xl lg:flex xl:right-16"
    >
      <span className="relative size-14 overflow-hidden rounded-2xl ring-2 ring-cyan-300">
        <img src={selfie.src} alt="" className="size-full object-cover object-[50%_22%]" />
      </span>
      <span>
        <span className="block text-[13px] text-navy-200">Priya, we found you in</span>
        <span className="block font-display text-xl font-semibold text-white">
          38 photos <span className="font-serif text-base font-normal text-cyan-300 italic">of 2,438</span>
        </span>
      </span>
    </motion.div>
  )
}

function Hero({ primaryTo }) {
  return (
    <section className="relative isolate overflow-hidden bg-navy-950">
      <MatchWall className="inset-0 lg:left-[36%]" />
      {/* keep the headline legible over the moving wall */}
      <div aria-hidden className="absolute inset-0 bg-navy-950/75 lg:hidden" />
      <div aria-hidden className="absolute inset-0 hidden bg-[linear-gradient(90deg,#020e39_32%,rgb(2_14_57/0.82)_46%,rgb(2_14_57/0.1)_75%)] lg:block" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-navy-950 to-transparent" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-navy-950 to-transparent" />

      <div className="container-page relative flex min-h-[max(700px,100svh)] items-center pt-28 pb-24">
        <div className="max-w-2xl max-lg:mx-auto max-lg:text-center">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full bg-white/5 py-1.5 pr-4 pl-1.5 text-[13px] text-navy-200 ring-1 ring-white/10 backdrop-blur"
          >
            <span className="grid size-6 place-items-center rounded-full bg-cyan-300 text-navy-950">
              <ScanFace className="size-3.5" />
            </span>
            AI face search for event photos
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.9, ease: EASE }}
            className="mt-7 text-[46px] leading-[0.98] font-bold tracking-[-0.045em] text-white sm:text-[68px] lg:text-[80px]"
          >
            Find every moment{' '}
            <span className="bg-gradient-to-r from-cyan-200 via-cyan-300 to-brand-400 bg-clip-text pr-2 font-serif font-normal tracking-[-0.01em] text-transparent italic">you’re in.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.9, ease: EASE }}
            className="mt-7 max-w-xl text-lg leading-relaxed text-navy-200 max-lg:mx-auto sm:text-xl"
          >
            Thousands of photos from the wedding, the fest, the summit. Take one selfie and get back only the ones you’re in, in about three seconds.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.9, ease: EASE }}
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 max-lg:justify-center"
          >
            <ShineButton to={primaryTo}>
              <Camera /> Find my photos
            </ShineButton>
            <a href="#how" className="group inline-flex items-center gap-2 text-[15px] font-medium text-white/80 hover:text-white">
              See how it works <ArrowDown className="size-4 transition-transform group-hover:translate-y-0.5" />
            </a>
          </motion.div>
          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-12 flex flex-wrap gap-x-7 gap-y-2 text-sm text-navy-300 max-lg:justify-center"
          >
            {['No app', 'No account', 'Your selfie is never stored'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="size-1.5 bg-cyan-300" /> {t}
              </li>
            ))}
          </motion.ul>
        </div>
      </div>
      <FoundToast />
    </section>
  )
}

// ---------------------------------------------------------- occasion ribbon

const OCCASIONS_WORDS = ['Weddings', 'Convocations', 'Conferences', 'College fests', 'Concerts', 'Birthdays', 'Offsites', 'Sports days', 'Parties']

function OccasionRibbon() {
  return (
    <section aria-label="Made for" className="border-b border-navy-100 bg-white py-8">
      <Marquee duration={50} gap="2.5rem">
        {OCCASIONS_WORDS.map((w) => (
          <span key={w} className="flex items-center gap-10 font-serif text-3xl whitespace-nowrap text-navy-900 italic sm:text-4xl">
            {w}
            <span aria-hidden className="size-2 bg-gradient-to-br from-brand-600 to-cyan-400 not-italic" />
          </span>
        ))}
      </Marquee>
    </section>
  )
}

// ------------------------------------------------------------ how it works

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="container-page">
        <SectionHeading eyebrow="For guests" title="Three steps." accent="Zero scrolling.">
          No app to download, no account to create. Guests go from the event link to their own photos in under a minute.
        </SectionHeading>
        <div className="mt-16 lg:mt-8">
          <GuestFlow />
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------ shared: split heading

// Title on the left, the supporting line on the right (so not every section
// is a centred block).
function SplitHeading({ eyebrow, title, children, dark }) {
  return (
    <Reveal className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-end lg:gap-16">
      <div>
        <p className={cn('inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.14em] uppercase', dark ? 'text-cyan-300' : 'text-brand-700')}>
          <span aria-hidden className={cn('size-1.5', dark ? 'bg-cyan-300' : 'bg-brand-600')} />
          {eyebrow}
        </p>
        <h2 className={cn('mt-4 text-[34px] leading-[1.04] font-semibold tracking-[-0.03em] sm:text-5xl lg:text-[56px]', dark ? 'text-white' : 'text-navy-950')}>{title}</h2>
      </div>
      {children && <p className={cn('max-w-lg text-lg leading-relaxed lg:pb-2', dark ? 'text-navy-300' : 'text-navy-500')}>{children}</p>}
    </Reveal>
  )
}

const Accent = ({ children, dark }) => <span className={cn('font-serif font-normal tracking-normal italic', dark ? 'text-cyan-300' : 'text-brand-600')}>{children}</span>

// ---------------------------------------------------------- before / after

const DIFFERENCE = [
  ['2,438', 'photos in the shared folder'],
  ['38', 'of them have you in them'],
  ['~3 s', 'to find all 38 with one selfie'],
]

function BeforeAfter() {
  return (
    <section className="relative overflow-hidden bg-canvas py-24 sm:py-32">
      <GridBackdrop />
      <div className="container-page relative">
        <SplitHeading
          eyebrow="The difference"
          title={
            <>
              Stop scrolling through <Accent>thousands of photos.</Accent>
            </>
          }
        >
          Drag the slider. On the left, the shared folder everyone digs through. On the right, only the photos a guest actually wants.
        </SplitHeading>
        <Reveal className="mt-12 sm:mt-14">
          <CompareSlider />
        </Reveal>
        <Reveal className="mt-6">
          <dl className="grid divide-y divide-navy-200/70 overflow-hidden rounded-3xl bg-white/70 ring-1 ring-navy-200/70 backdrop-blur sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {DIFFERENCE.map(([n, label], i) => (
              <div key={label} className="flex items-baseline gap-4 px-6 py-5 sm:block sm:px-8 sm:py-7">
                <dt className={cn('font-display text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl', i === 1 ? 'text-brand-600' : 'text-navy-950')}>{n}</dt>
                <dd className="text-[15px] text-navy-500 sm:mt-2">{label}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- features

function Features() {
  return (
    <section id="features" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="container-page">
        <SplitHeading
          eyebrow="Features"
          title={
            <>
              Everything guests need. <Accent>Nothing they don’t.</Accent>
            </>
          }
        >
          Built around one moment: a guest holding up their phone and seeing themselves, in seconds.
        </SplitHeading>
        <div className="mt-14">
          <FeatureBento />
        </div>
      </div>
    </section>
  )
}

// -------------------------------------------------------------- organizers

function Organizers() {
  return (
    <section id="organizers" className="relative scroll-mt-16 overflow-hidden bg-navy-950 py-24 sm:py-32">
      <GridBackdrop dark />
      <div aria-hidden className="absolute -top-40 -right-40 size-[640px] rounded-full bg-brand-600/20 blur-[140px]" />
      <div aria-hidden className="absolute -bottom-60 -left-40 size-[520px] rounded-full bg-cyan-500/10 blur-[140px]" />
      <div className="container-page relative">
        <OrganizerSection>
          <SectionHeading dark center={false} eyebrow="For organizers & photographers" title="Deliver photos guests" accent="actually find.">
            Turn a folder of thousands of photos into a personal gallery for every guest, and see exactly who came looking.
          </SectionHeading>
          <Reveal className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link to="/login" className="group inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-semibold text-navy-950 transition-colors hover:bg-cyan-50">
              Organizer login <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <span className="text-sm text-navy-400">Accounts are created by your Super Admin.</span>
          </Reveal>
        </OrganizerSection>
      </div>
    </section>
  )
}

// --------------------------------------------------------------- occasions

const OCCASION_ROWS = [
  [
    ['8vmvtj_W4xQ', 'Weddings', 'Every guest, every ritual.'],
    ['3EMw3T-ZjkE', 'Convocations', 'Caps in the air, found.'],
    ['CnAgA4rmGUQ', 'Conferences', 'Speakers and every attendee.'],
    ['_HzlOHmboSk', 'College fests', 'The whole crowd, not just the stage.'],
    ['nPz8akkUmDI', 'Concerts', 'Find yourself in the crowd.'],
  ],
  [
    ['LO1lToLGGFA', 'Birthdays', 'Every candid from the night.'],
    ['WJPHTJEtgzw', 'Corporate', 'Offsites, awards and team days.'],
    ['GLKM5guF69Y', 'Sports', 'Players, fans and every goal.'],
    ['Y8XxrkzwdyI', 'Parties', 'Rooftops and dance floors.'],
    ['wmhehhmeA1o', 'Hackathons', 'Three days, one gallery.'],
  ],
]

function OccasionCard({ p, title, text, wide }) {
  return (
    <figure className={cn('group relative shrink-0 overflow-hidden rounded-[28px] bg-navy-100', wide ? 'aspect-[4/3] w-[300px] sm:w-[380px]' : 'aspect-[3/4] w-[220px] sm:w-[270px]')}>
      <Photo photo={p} className="absolute inset-0" imgClassName="transition-transform duration-700 ease-out group-hover:scale-[1.06]" />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/90 via-navy-950/35 to-transparent p-5 pt-16 sm:p-6 sm:pt-20">
        <p className="font-serif text-3xl leading-none text-white italic">{title}</p>
        <p className="mt-2 text-sm text-white/75">{text}</p>
      </figcaption>
    </figure>
  )
}

function Occasions() {
  return (
    <section className="overflow-hidden bg-white py-24 sm:py-32">
      <div className="container-page">
        <SplitHeading
          eyebrow="Event types"
          title={
            <>
              Made for every <Accent>occasion.</Accent>
            </>
          }
        >
          Wherever there’s a photographer, there’s a guest who wants to find themselves afterwards.
        </SplitHeading>
      </div>
      <Reveal className="mt-14 grid gap-5">
        {OCCASION_ROWS.map((row, r) => {
          const photos = byIds(row.map((o) => o[0])).map(thumb)
          return (
            <Marquee key={r} duration={r ? 64 : 56} gap="1.25rem" reverse={r === 1}>
              {photos.map((p, i) => (
                <OccasionCard key={p.id} p={p} title={row[i][1]} text={row[i][2]} wide={r === 1} />
              ))}
            </Marquee>
          )
        })}
      </Reveal>
    </section>
  )
}

// ------------------------------------------------------------------ privacy

const PRIVACY = [
  [Lock, 'Your selfie is never stored', 'It becomes a face signature for one search, then it’s thrown away. Never added to a gallery, never shown to anyone.'],
  [EyeOff, 'You only see your own photos', 'Results open with a private key made for your search. Nobody can browse an event’s gallery.'],
  [ScanFace, 'One event at a time', 'A search looks inside the event you picked, and nowhere else.'],
  [UserRound, 'Organizers see your name, not your face', 'Your name and email tell the organizer who searched. Your selfie never reaches them.'],
]

function Privacy() {
  return (
    <section id="privacy" className="scroll-mt-16 bg-canvas py-24 sm:py-32">
      <div className="container-page">
        {/* Aceternity "moving border": a light that travels round the card */}
        <Reveal>
          <div
            className="relative animate-border-spin overflow-hidden rounded-[36px] border border-transparent"
            style={{
              background:
                'linear-gradient(#020e39, #020e39) padding-box, conic-gradient(from var(--border-angle), rgb(114 209 251 / 0.08) 0%, rgb(114 209 251 / 0.08) 70%, #72d1fb 85%, rgb(114 209 251 / 0.08) 100%) border-box',
            }}
          >
            <div aria-hidden className="absolute -top-40 -left-24 size-[520px] rounded-full bg-brand-600/25 blur-[120px]" />
            <GridBackdrop dark />
            <div className="relative grid gap-12 p-7 sm:p-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:p-16">
              <div className="lg:py-4">
                <span className="grid size-14 place-items-center rounded-2xl bg-cyan-300 text-navy-950 shadow-[0_0_40px_rgb(5_176_246/0.5)]">
                  <ShieldCheck className="size-7" />
                </span>
                <h2 className="mt-7 text-[34px] leading-[1.04] font-semibold tracking-[-0.03em] text-white sm:text-5xl">
                  Face search, <Accent dark>handled with care.</Accent>
                </h2>
                <p className="mt-5 max-w-md text-lg leading-relaxed text-navy-300">
                  Face data is biometric data, and we treat it that way. Every guest agrees in plain language before their first search.
                </p>
                <div className="mt-8 flex flex-wrap gap-3 text-sm font-semibold">
                  <Link to="/privacy" className="rounded-full bg-white/10 px-4 py-2 text-white ring-1 ring-white/15 transition-colors hover:bg-white/15">
                    Privacy Policy →
                  </Link>
                  <Link to="/consent" className="rounded-full bg-white/10 px-4 py-2 text-white ring-1 ring-white/15 transition-colors hover:bg-white/15">
                    Biometric consent →
                  </Link>
                </div>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {PRIVACY.map(([Icon, t, d], i) => (
                  <motion.li
                    key={t}
                    initial={{ opacity: 0, y: 14 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="rounded-3xl bg-white/[0.04] p-6 ring-1 ring-white/10 transition-colors hover:bg-white/[0.07]"
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-cyan-300">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="mt-5 font-semibold text-white">{t}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-navy-300">{d}</p>
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------- FAQ

const FAQS = [
  ['Do I need an app or an account?', 'No. Genesis Hub runs in your phone’s browser. Open the event link, type your name and email, take a selfie, and you’re done.'],
  ['Why do you ask for my name and email?', 'So the organizer knows who searched for photos. They see your name and email, never your selfie.'],
  ['What if the camera doesn’t work?', 'Upload any clear photo of yourself instead. A front-facing photo in good light works best.'],
  ['How accurate is it?', 'Very accurate for clear faces. Faces that are tiny, blurry or turned away are skipped rather than guessed, so strangers don’t end up in your results.'],
  ['Can other guests see my photos?', 'No. Your results open only for your search. Nobody can browse an event’s whole gallery.'],
  ['Is my selfie stored?', 'No. It’s used once to run your search, then discarded. It’s never added to the event’s gallery.'],
  ['How do organizers get started?', 'Ask the Super Admin for an organizer login. Then create your events, upload the photos (a folder or a Google Drive link), and share the event link with guests.'],
]

function FaqItem({ q, a, open, onToggle, id }) {
  return (
    <li className="border-b border-navy-100">
      <h3>
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={id}
          className="group flex w-full items-center justify-between gap-6 py-6 text-left text-lg font-medium text-navy-950 sm:text-xl"
        >
          {q}
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-full transition-colors duration-300', open ? 'bg-brand-600 text-white' : 'bg-navy-50 text-navy-500 group-hover:bg-navy-100')}>
            <Plus className={cn('size-4 transition-transform duration-300', open && 'rotate-45')} />
          </span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            role="region"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: EASE }}
            className="overflow-hidden"
          >
            <p className="pr-14 pb-7 text-[17px] leading-relaxed text-navy-500">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

function FAQ({ primaryTo }) {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="scroll-mt-16 bg-white py-24 sm:py-32">
      <div className="container-page grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <Reveal className="lg:sticky lg:top-28 lg:self-start">
          <p className="inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.14em] text-brand-700 uppercase">
            <span aria-hidden className="size-1.5 bg-brand-600" /> FAQ
          </p>
          <h2 className="mt-4 text-[34px] leading-[1.04] font-semibold tracking-[-0.03em] text-navy-950 sm:text-5xl">
            Questions, <Accent>answered.</Accent>
          </h2>
          <p className="mt-5 max-w-sm text-lg leading-relaxed text-navy-500">Everything guests usually ask before their first search.</p>
          <Link to={primaryTo} className="group mt-8 inline-flex items-center gap-2 font-semibold text-brand-700">
            Try it on your event <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
        <ul className="border-t border-navy-100">
          {FAQS.map(([q, a], i) => (
            <FaqItem key={q} q={q} a={a} id={`faq-${i}`} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
          ))}
        </ul>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------- CTA

// Photos from the event float around the headline; the ones you're in wear
// a face ring, like results do.
const FLOATING = [
  ['DVmEj6ptFbc', 'top-[9%] left-[5%] w-44 -rotate-6', true],
  ['8vmvtj_W4xQ', 'top-[6%] right-[7%] w-48 rotate-[5deg]', false],
  ['LO1lToLGGFA', 'bottom-[10%] left-[9%] w-36 rotate-[4deg]', true],
  ['Y8XxrkzwdyI', 'bottom-[7%] right-[5%] w-52 -rotate-[4deg]', false],
  ['zc6ezUR4-8I', 'top-[42%] left-[1%] w-36 -rotate-3 max-xl:hidden', false],
  ['QbGPGsliC5w', 'top-[40%] right-[1%] w-36 rotate-6 max-xl:hidden', true],
  ['3EMw3T-ZjkE', 'top-[3%] left-[33%] w-32 rotate-2 max-lg:hidden', false],
  ['ee9plLQf41E', 'bottom-[3%] right-[31%] w-32 -rotate-2 max-lg:hidden', true],
]

function FinalCta({ primaryTo }) {
  const photos = byIds(FLOATING.map((f) => f[0])).map(thumb)
  return (
    <section className="relative isolate overflow-hidden bg-navy-950 py-32 sm:py-44">
      <GridBackdrop dark />
      <div aria-hidden className="absolute top-1/2 left-1/2 -z-10 size-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/30 blur-[160px]" />
      {photos.map((p, i) => {
        const [, pos, matched] = FLOATING[i]
        return (
          <motion.div
            key={p.id}
            aria-hidden
            className={cn('absolute max-md:hidden', pos)}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: matched ? 1 : 0.45, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.07, duration: 0.8, ease: EASE }}
          >
            <motion.div animate={{ y: [0, i % 2 ? 10 : -10, 0] }} transition={{ duration: 6 + (i % 3), repeat: Infinity, ease: 'easeInOut' }}>
              <Photo photo={p} ratio="natural" face={matched ? largestFace(p) : undefined} className="rounded-2xl shadow-pop ring-1 ring-white/15" />
            </motion.div>
          </motion.div>
        )
      })}
      {/* phones: a small fan of photos above the headline instead */}
      <div aria-hidden className="relative mx-auto mb-10 flex h-28 w-64 justify-center md:hidden">
        {photos.slice(0, 3).map((p, i) => (
          <div key={p.id} className="absolute w-28" style={{ transform: `translateX(${(i - 1) * 70}px) rotate(${(i - 1) * 8}deg)`, zIndex: i === 1 ? 2 : 1 }}>
            <Photo photo={p} ratio="4 / 3" className="rounded-xl ring-2 ring-white/20" />
          </div>
        ))}
      </div>
      <div className="container-page relative text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto inline-flex items-center gap-2 rounded-full bg-white/5 py-1.5 pr-4 pl-1.5 text-[13px] text-navy-200 ring-1 ring-white/10 backdrop-blur"
        >
          <span className="grid size-6 place-items-center rounded-full bg-cyan-300 text-navy-950">
            <ScanFace className="size-3.5" />
          </span>
          One selfie. Every moment.
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15, duration: 0.8, ease: EASE }}
          className="mx-auto mt-7 max-w-3xl text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-white sm:text-6xl lg:text-[68px]"
        >
          Your next event has thousands of moments.{' '}
          <span className="block">
            <Accent dark>Let every guest find theirs.</Accent>
          </span>
        </motion.h2>
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-11 flex flex-wrap items-center justify-center gap-x-6 gap-y-4"
        >
          <ShineButton to={primaryTo}>
            <Camera /> Find my photos
          </ShineButton>
          <Link to="/login" className="text-[15px] font-medium text-white/75 hover:text-white">
            Organizer login →
          </Link>
        </motion.div>
      </div>
    </section>
  )
}

export default function Landing() {
  useDocumentTitle()
  const { user } = useAuth()
  const primaryTo = user ? ROLE_HOME[user.role] : '/events'
  return (
    <>
      <Hero primaryTo={primaryTo} />
      <OccasionRibbon />
      <HowItWorks />
      <BeforeAfter />
      {/* <Features /> */}
      <Organizers />
      <Occasions />
      <Privacy />
      <FAQ primaryTo={primaryTo} />
      <FinalCta primaryTo={primaryTo} />
    </>
  )
}
