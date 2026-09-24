import { SwitchCamera } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/utils'

const BURST = 3
const GAP_MS = 140
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

export const cameraSupported = () => Boolean(navigator.mediaDevices?.getUserMedia)

function grab(video) {
  const c = document.createElement('canvas')
  c.width = video.videoWidth
  c.height = video.videoHeight
  c.getContext('2d').drawImage(video, 0, 0)
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92))
}

const GUIDE = {
  starting: 'Starting camera…',
  looking: 'Looking for your face…',
  detected: 'Face detected',
  perfect: 'Perfect! Hold still',
}

// Full-bleed selfie camera with an oval face guide. Reports
// 'denied' | 'no_camera' | 'busy' | 'insecure' through onError.
export default function SelfieCamera({ onCapture, onError, topBar, footer }) {
  const videoRef = useRef(null)
  const [facing, setFacing] = useState('user')
  const [guide, setGuide] = useState('starting')
  const [multi, setMulti] = useState(false)
  const [flash, setFlash] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!cameraSupported()) {
      onError('insecure')
      return
    }
    let stream
    let cancelled = false
    const timers = []
    setGuide('starting')
    navigator.mediaDevices
      .getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 } } })
      .then(async (s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        videoRef.current.srcObject = s
        await videoRef.current.play().catch(() => {})
        setGuide('looking')
        // The real face check happens after capture (on the server); these
        // guide states just coach the user into a good frame.
        timers.push(setTimeout(() => !cancelled && setGuide('detected'), 1400))
        timers.push(setTimeout(() => !cancelled && setGuide('perfect'), 2300))
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!cancelled) setMulti(devices.filter((d) => d.kind === 'videoinput').length > 1)
      })
      .catch((err) => {
        if (cancelled) return
        const kind = { NotAllowedError: 'denied', SecurityError: 'denied', NotFoundError: 'no_camera', OverconstrainedError: 'no_camera', NotReadableError: 'busy' }[err.name] || 'no_camera'
        onError(kind)
      })
    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing, onError])

  const capture = async () => {
    const v = videoRef.current
    if (!v || busy || guide === 'starting') return
    setBusy(true)
    const frames = []
    for (let i = 0; i < BURST; i++) {
      if (i) await wait(GAP_MS)
      const b = await grab(v)
      if (b) frames.push(b)
    }
    setFlash(true)
    if (frames.length) onCapture(frames)
  }

  const good = guide === 'detected' || guide === 'perfect'

  return (
    <div className="relative flex h-dvh flex-col bg-black">
      <div className="relative min-h-0 flex-1 overflow-hidden sm:mx-auto sm:my-6 sm:aspect-[3/4] sm:w-auto sm:flex-none sm:basis-[min(78dvh,760px)] sm:rounded-[32px]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={cn('absolute inset-0 size-full object-cover', facing === 'user' && '-scale-x-100')}
        />
        {/* dimmed surround + oval guide */}
        <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
          <motion.div
            animate={{ scale: guide === 'perfect' ? 1.02 : 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            className={cn(
              'relative aspect-[3/4] w-[68%] max-w-[340px] rounded-[50%] border-[3px] shadow-[0_0_0_9999px_rgb(2_14_57/0.55)] transition-colors duration-500',
              good ? 'border-cyan-300' : 'border-white/80',
            )}
          >
            {guide === 'looking' && <span className="absolute inset-0 overflow-hidden rounded-[50%]"><span className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent to-cyan-300/40" /></span>}
            {guide === 'perfect' && <span className="absolute inset-0 animate-pulse-ring rounded-[50%]" />}
          </motion.div>
        </div>
        {/* status */}
        <div className="absolute inset-x-0 top-[max(5.5rem,calc(env(safe-area-inset-top)+4.5rem))] flex justify-center sm:top-auto sm:bottom-6">
          <AnimatePresence mode="wait">
            <motion.span
              key={guide}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium backdrop-blur-md',
                good ? 'bg-cyan-300 text-navy-950' : 'bg-navy-950/60 text-white ring-1 ring-white/15',
              )}
              role="status"
            >
              {GUIDE[guide]}
            </motion.span>
          </AnimatePresence>
        </div>
        <AnimatePresence>
          {flash && (
            <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.45 }} onAnimationComplete={() => setFlash(false)} />
          )}
        </AnimatePresence>
      </div>

      {topBar && <div className="absolute inset-x-0 top-0">{topBar}</div>}

      <div className="relative flex items-center justify-center gap-10 bg-black px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:bg-transparent sm:pt-0">
        <span className="size-12" />
        <button
          onClick={capture}
          disabled={guide === 'starting' || busy}
          aria-label="Take selfie"
          className="group grid size-[78px] place-items-center rounded-full border-4 border-white transition-transform active:scale-95 disabled:opacity-40"
        >
          <span className={cn('size-[62px] rounded-full transition-colors duration-300', good ? 'bg-gradient-to-b from-brand-500 to-cyan-400' : 'bg-white')} />
        </button>
        <button
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          disabled={!multi}
          aria-label="Switch camera"
          className="grid size-12 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-opacity disabled:opacity-0"
        >
          <SwitchCamera className="size-5" />
        </button>
      </div>
      {footer}
    </div>
  )
}
