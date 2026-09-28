import { Camera, CameraOff, ImagePlus, Lock, Mail, ScanFace, ShieldCheck, Smartphone, TriangleAlert, Upload, UserRound, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { TextReveal } from '../../components/effects'
import SelfieCamera from '../../components/SelfieCamera'
import Button from '../../components/ui/Button'
import { Checkbox, Field, Input } from '../../components/ui/primitives'
import { LogoMark } from '../../components/ui/Logo'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { cn, num } from '../../lib/utils'
import { getGuestEvent } from '../../services/eventService'
import { FaceError, giveConsent, hasConsent, isEmail, savedVisitor, saveVisitor, search } from '../../services/searchService'
import { EventUnavailable } from './EventDetail'

const SEARCH_STEPS = (n) => [
  'Analyzing your photo…',
  'Finding your face…',
  `Searching ${num(n)} event photos…`,
  'Comparing faces…',
  'Finding your moments…',
  'Almost there…',
]

const ERRORS = {
  denied: {
    icon: CameraOff,
    title: 'Camera access is turned off',
    text: 'Allow camera access for this site in your browser settings, then try again. Or upload a photo instead.',
  },
  insecure: {
    icon: Lock,
    title: 'Live camera isn’t available here',
    text: 'Your browser only allows the live camera on secure (https) pages. Use your phone’s camera app or upload a photo instead.',
  },
  no_camera: { icon: CameraOff, title: 'We couldn’t find a camera', text: 'This device doesn’t seem to have a camera we can use. Upload a photo instead.' },
  busy: { icon: CameraOff, title: 'Your camera is busy', text: 'Another app is using the camera. Close it and try again, or upload a photo.' },
  no_face: { icon: ScanFace, title: 'No face detected', text: 'We couldn’t see a face. Face the camera in good, even light and try again.' },
  too_small: { icon: ScanFace, title: 'Face too small', text: 'You’re a little far away. Move closer so your face fills the oval.' },
  unreadable: { icon: TriangleAlert, title: 'We can’t read that file', text: 'Try a JPG, PNG or HEIC photo taken with your phone.' },
  offline: { icon: TriangleAlert, title: 'Face search is offline', text: 'The face-matching engine isn’t reachable right now. Please try again in a few minutes.' },
  not_found: { icon: Lock, title: 'This event isn’t open for search', text: 'The organizer hasn’t opened this event to guests yet, or it has been archived.' },
  failed: { icon: TriangleAlert, title: 'Search didn’t finish', text: 'Something went wrong on our side. Your photo wasn’t saved. Please try again.' },
}

async function normalize(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * s)
    c.height = Math.round(bmp.height * s)
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height)
    bmp.close?.()
    return (await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92))) || file
  } catch {
    return file
  }
}

function TopBar({ ev, onClose, dark = true }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-6">
      <button
        onClick={onClose}
        className={cn('grid size-10 place-items-center rounded-full backdrop-blur', dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-navy-100 text-navy-800')}
        aria-label="Close"
      >
        <X className="size-5" />
      </button>
      {ev && (
        <span className="mx-auto flex min-w-0 items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] text-white/90 ring-1 ring-white/10 backdrop-blur">
          <span className="size-1.5 shrink-0 rounded-full bg-cyan-300" />
          <span className="truncate">
            Searching in <span className="font-semibold text-white">{ev.name}</span>
          </span>
        </span>
      )}
      <span className="size-10 shrink-0" />
    </div>
  )
}

// Name + email (so the organizer knows who searched) and consent, in one card.
function Consent({ ev, initial, agreed, serverError, onAccept, onClose }) {
  const [agree, setAgree] = useState(agreed)
  const [name, setName] = useState(initial?.name || '')
  const [email, setEmail] = useState(initial?.email || '')
  const [touched, setTouched] = useState(false)
  const nameError = name.trim().length < 2 ? 'Please enter your name.' : null
  const emailError = !isEmail(email) ? 'Please enter a valid email address.' : null
  const submit = (e) => {
    e.preventDefault()
    setTouched(true)
    if (!nameError && !emailError && agree) onAccept({ name, email })
  }
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr]">
      <TopBar ev={ev} onClose={onClose} />
      <div className="flex items-end justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
        <motion.form
          onSubmit={submit}
          noValidate
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="w-full max-w-md rounded-3xl bg-white p-6 shadow-pop sm:p-8"
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">
            <ShieldCheck className="size-6" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold text-navy-950">Before we search</h1>
          <p className="mt-2 text-navy-500">Tell us who you are, then take a selfie or upload a photo.</p>
          <div className="mt-5 grid gap-4">
            <Field label="Your name" htmlFor="visitor-name" error={touched && nameError}>
              <Input id="visitor-name" icon={UserRound} value={name} onChange={(e) => setName(e.target.value)} placeholder="Priya Sharma" autoComplete="name" aria-invalid={touched && !!nameError} maxLength={150} />
            </Field>
            <Field label="Email" htmlFor="visitor-email" error={touched && emailError}>
              <Input id="visitor-email" type="email" icon={Mail} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" inputMode="email" aria-invalid={touched && !!emailError} maxLength={255} />
            </Field>
            {serverError && <p className="text-sm text-bad">{serverError}</p>}
          </div>
          <ul className="mt-5 grid gap-2.5 text-sm text-navy-600">
            {[
              `We only search ${ev.name}.`,
              'Your selfie isn’t stored, added to the gallery or shown to anyone.',
              'The organizer sees your name and email, so they know who searched.',
            ].map((t) => (
              <li key={t} className="flex gap-3">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" />
                {t}
              </li>
            ))}
          </ul>
          <label className="mt-6 flex items-start gap-3 rounded-xl bg-navy-50 p-3.5 text-sm text-navy-700">
            <Checkbox checked={agree} onChange={setAgree} className="mt-0.5" label="I agree" />
            <span>
              I agree to Genesis Hub using my photo to search this event.{' '}
              <Link to="/consent" target="_blank" className="font-medium text-brand-700 hover:underline">
                Read the details
              </Link>
            </span>
          </label>
          <Button type="submit" size="lg" className="mt-5 w-full" disabled={!agree}>
            Continue
          </Button>
        </motion.form>
      </div>
    </div>
  )
}

function UploadStep({ ev, onFile, onClose }) {
  const input = useRef(null)
  const [drag, setDrag] = useState(false)
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr]">
      <TopBar ev={ev} onClose={onClose} />
      <div className="flex items-center justify-center p-4">
        <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
        <button
          onClick={() => input.current.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0])
          }}
          className={cn(
            'grid w-full max-w-md justify-items-center rounded-[28px] border-2 border-dashed px-8 py-14 text-center transition-colors',
            drag ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06]',
          )}
        >
          <span className="grid size-16 place-items-center rounded-2xl bg-gradient-to-b from-brand-500 to-brand-700 text-white shadow-[0_0_40px_rgb(7_105_238/0.5)]">
            <ImagePlus className="size-7" />
          </span>
          <span className="mt-6 text-2xl font-semibold text-white">Upload a photo of you</span>
          <span className="mt-2 text-navy-300">A clear, front-facing photo works best. Just you, if possible.</span>
          <span className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-5 font-medium text-navy-950">
            <Upload className="size-4" /> Choose photo
          </span>
          <span className="mt-3 text-[13px] text-navy-400 max-sm:hidden">or drop it here</span>
        </button>
      </div>
    </div>
  )
}

function ScanPreview({ src, message, progress, found }) {
  return (
    <div className="flex flex-col items-center px-6 text-center">
      <div className="relative">
        <motion.div
          layoutId="selfie"
          className={cn('relative size-44 overflow-hidden rounded-full ring-4 transition-[box-shadow] duration-700 sm:size-52', found ? 'ring-cyan-300 shadow-[0_0_80px_rgb(5_176_246/0.5)]' : 'ring-white/15')}
        >
          {src && <img src={src} alt="Your photo" className="size-full object-cover" />}
          {!found && <span className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent to-cyan-300/60" />}
        </motion.div>
        {progress != null && (
          <svg className="absolute -inset-3 size-[calc(100%+24px)] -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="1.5" />
            <motion.circle cx="50" cy="50" r="48" fill="none" stroke="url(#ring)" strokeWidth="1.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: progress }} transition={{ duration: 0.6 }} />
            <defs>
              <linearGradient id="ring">
                <stop stopColor="#0769ee" />
                <stop offset="1" stopColor="#05b0f6" />
              </linearGradient>
            </defs>
          </svg>
        )}
      </div>
      <div className="mt-10 h-8" aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.p key={message} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="text-lg font-medium text-white">
            {message}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function Search() {
  const { eventId } = useParams()
  const [params] = useSearchParams()
  const mode = params.get('mode') === 'upload' ? 'upload' : 'selfie'
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data: ev, error: loadError, loading } = useQuery(() => getGuestEvent(eventId), [eventId], { live: false })
  useDocumentTitle(ev ? `Find your photos · ${ev.name}` : 'Find your photos')

  const consentId = user?.id ?? 'guest'
  const [visitor, setVisitor] = useState(() => savedVisitor() || (user ? { name: user.name, email: user.email } : null))
  const [step, setStep] = useState(() => (hasConsent(consentId, eventId) && savedVisitor() ? mode : 'consent'))
  const [detailsError, setDetailsError] = useState(null)
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  const [msgIndex, setMsgIndex] = useState(0)
  const [found, setFound] = useState(null)
  const nativeCam = useRef(null)
  const uploadInput = useRef(null)

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview])

  const close = () => navigate(`/events/${eventId}`)

  const run = useCallback(
    async (blobs) => {
      setPreview(URL.createObjectURL(blobs[0]))
      setError(null)
      setStep('searching')
      setMsgIndex(0)
      try {
        const started = Date.now()
        const result = await search(eventId, blobs, visitor)
        // let the progress animation land instead of flashing past
        await new Promise((r) => setTimeout(r, Math.max(0, 2400 - (Date.now() - started))))
        setFound(result.hits.length)
        setStep('found')
        setTimeout(() => navigate(`/events/${eventId}/results`, { replace: true, state: { fresh: true } }), result.hits.length ? 2300 : 900)
      } catch (e) {
        if (e instanceof FaceError && e.code === 'details') {
          // the server didn't accept the name/email: ask again
          setDetailsError(e.message)
          setStep('consent')
          return
        }
        setError(e instanceof FaceError ? e.code : 'failed')
        setStep('error')
      }
    },
    [eventId, navigate, visitor],
  )

  // cycle the contextual search messages
  useEffect(() => {
    if (step !== 'searching') return
    const t = setInterval(() => setMsgIndex((i) => Math.min(i + 1, 5)), 680)
    return () => clearInterval(t)
  }, [step])

  const onCameraError = useCallback((kind) => {
    setError(kind)
    setStep('error')
  }, [])

  const onFile = async (file) => run([await normalize(file)])

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-navy-950">
        <LogoMark size={44} dark className="animate-pulse" />
      </div>
    )
  }
  if (loadError || !ev) return <EventUnavailable error={loadError} />

  const err = error && ERRORS[error]
  const cameraProblem = ['denied', 'insecure', 'no_camera', 'busy'].includes(error)
  const steps = SEARCH_STEPS(ev.photoCount)

  return (
    <div className="min-h-dvh bg-navy-950 text-white">
      <input ref={nativeCam} type="file" accept="image/*" capture="user" hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
      <input ref={uploadInput} type="file" accept="image/*" hidden onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />

      {step === 'consent' && (
        <Consent
          ev={ev}
          initial={visitor}
          agreed={hasConsent(consentId, eventId)}
          serverError={detailsError}
          onClose={close}
          onAccept={(v) => {
            giveConsent(consentId, eventId)
            saveVisitor(v)
            setVisitor(v)
            setDetailsError(null)
            setStep(mode)
          }}
        />
      )}

      {step === 'selfie' && (
        <SelfieCamera
          onCapture={run}
          onError={onCameraError}
          topBar={<TopBar ev={ev} onClose={close} />}
          footer={
            <button onClick={() => uploadInput.current.click()} className="absolute bottom-[max(2.2rem,calc(env(safe-area-inset-bottom)+1.4rem))] left-6 flex flex-col items-center gap-1 text-[11px] text-white/80 sm:left-[calc(50%-220px)]">
              <span className="grid size-12 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
                <ImagePlus className="size-5" />
              </span>
              Upload
            </button>
          }
        />
      )}

      {step === 'upload' && <UploadStep ev={ev} onFile={onFile} onClose={close} />}

      {(step === 'checking' || step === 'searching' || step === 'found') && (
        <div className="relative grid min-h-dvh grid-rows-[auto_1fr_auto] overflow-hidden">
          <div aria-hidden className="absolute top-1/3 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-600/20 blur-[120px]" />
          <TopBar ev={ev} onClose={close} />
          <div className="relative flex flex-col items-center justify-center">
            {step === 'found' ? (
              <>
                <ScanPreview src={preview} found />
                <div className="-mt-4 px-6 text-center">
                  {found ? (
                    <>
                      <TextReveal as="h1" text="We found your moments." className="block text-4xl font-semibold tracking-tight sm:text-5xl" />
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-3 text-lg text-navy-300">
                        {found} photos from {ev.name}
                      </motion.p>
                    </>
                  ) : (
                    <h1 className="text-3xl font-semibold">Opening your results…</h1>
                  )}
                </div>
              </>
            ) : (
              <ScanPreview
                src={preview}
                message={step === 'checking' ? 'Finding your face…' : steps[msgIndex]}
                progress={step === 'checking' ? 0.08 : (msgIndex + 1) / steps.length}
              />
            )}
          </div>
          <p className="relative px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center text-[13px] text-navy-400">
            Searching only {ev.name}. Your photo is not added to the gallery.
          </p>
        </div>
      )}

      {step === 'error' && err && (
        <div className="grid min-h-dvh grid-rows-[auto_1fr]">
          <TopBar ev={ev} onClose={close} />
          <div className="flex items-center justify-center px-5 pb-10">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid w-full max-w-md justify-items-center text-center">
              {preview && !cameraProblem ? (
                <div className="relative mb-6 size-28 overflow-hidden rounded-full ring-4 ring-amber-300/60">
                  <img src={preview} alt="Your photo" className="size-full object-cover" />
                </div>
              ) : (
                <span className="mb-6 grid size-16 place-items-center rounded-2xl bg-white/10 text-amber-200 ring-1 ring-white/10">
                  <err.icon className="size-7" />
                </span>
              )}
              <h1 className="text-2xl font-semibold">{err.title}</h1>
              <p className="mt-2 text-navy-300">{err.text}</p>
              <div className="mt-8 grid w-full gap-2.5">
                {cameraProblem ? (
                  <>
                    <Button size="lg" variant="light" onClick={() => uploadInput.current.click()}>
                      <Upload /> Upload a photo instead
                    </Button>
                    <Button size="lg" variant="glass" onClick={() => nativeCam.current.click()} className="md:hidden">
                      <Smartphone /> Use my phone’s camera app
                    </Button>
                    {error !== 'insecure' && (
                      <Button size="lg" variant="glass" onClick={() => setStep('selfie')}>
                        <Camera /> Try the camera again
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button size="lg" variant="light" onClick={() => setStep('selfie')}>
                      <Camera /> Retake selfie
                    </Button>
                    <Button size="lg" variant="glass" onClick={() => uploadInput.current.click()}>
                      <Upload /> Upload a different photo
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  )
}
