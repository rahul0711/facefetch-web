import { useEffect, useRef, useState } from 'react'
import { grabVideoFrame } from './api'
import { CameraIcon, CloseIcon, LockIcon, SwitchIcon } from './icons'

// Frames grabbed per capture, a short beat apart -- averaged server-side
// into one steadier query than any single frame.
const BURST_FRAMES = 3
const BURST_GAP_MS = 140

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function cameraErrorMessage(name) {
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera permission was blocked. Allow camera access in your browser settings, or use the options below.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device.'
    case 'NotReadableError':
      return 'Your camera is busy in another app. Close it there and try again.'
    default:
      return 'The camera could not be started.'
  }
}

// getUserMedia only exists on secure origins (https:// or localhost) -- on a
// phone opening http://<lan-ip> it's simply undefined.
const cameraSupported = () => Boolean(navigator.mediaDevices?.getUserMedia)

export default function CameraCapture({ onCapture, onCancel, onUseNativeCamera, onUpload }) {
  const videoRef = useRef(null)
  const [facing, setFacing] = useState('user')
  const [error, setError] = useState(cameraSupported() ? null : 'insecure')
  const [ready, setReady] = useState(false)
  const [multiCam, setMultiCam] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!cameraSupported()) return
    let stream = null
    let cancelled = false

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 960 } },
      })
      .then(async (s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        const video = videoRef.current
        video.srcObject = s
        await video.play().catch(() => {})
        setReady(true)
        setError(null)
        // Device labels/count are only reliable after permission is granted.
        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!cancelled) setMultiCam(devices.filter((d) => d.kind === 'videoinput').length > 1)
      })
      .catch((err) => {
        if (!cancelled) setError(err.name || 'Error')
      })

    return () => {
      cancelled = true
      setReady(false)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [facing])

  const capture = async () => {
    const video = videoRef.current
    if (!video || !ready || capturing) return
    setCapturing(true)
    try {
      const frames = []
      for (let i = 0; i < BURST_FRAMES; i++) {
        if (i) await wait(BURST_GAP_MS)
        const blob = await grabVideoFrame(video)
        if (blob) frames.push(blob)
      }
      setFlash(true)
      if (frames.length) onCapture(frames)
    } finally {
      setCapturing(false)
    }
  }

  const mirrored = facing === 'user'

  return (
    <div className="ff-cam">
      <div className="ff-cam__stage">
        {error ? (
          <div className="ff-cam__error">
            {error === 'insecure' ? <LockIcon size={34} /> : <CameraIcon size={34} />}
            <h3>{error === 'insecure' ? 'Live camera needs a secure connection' : 'Camera unavailable'}</h3>
            <p>
              {error === 'insecure'
                ? 'Browsers only allow live camera access on https:// pages. You can still snap a selfie with your phone camera app or pick a photo.'
                : cameraErrorMessage(error)}
            </p>
            <div className="ff-cam__error-actions">
              <button className="ff-btn ff-btn--primary" onClick={onUseNativeCamera}>
                <CameraIcon /> Open phone camera
              </button>
              <button className="ff-btn ff-btn--ghost" onClick={onUpload}>
                Choose a photo
              </button>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className={`ff-cam__video${mirrored ? ' ff-cam__video--mirror' : ''}`}
              playsInline
              muted
              autoPlay
            />
            <div className="ff-cam__guide" aria-hidden="true">
              <div className="ff-cam__oval" />
            </div>
            <p className="ff-cam__hint">{ready ? 'Centre your face in the oval' : 'Starting camera…'}</p>
            {flash && <div className="ff-cam__flash" onAnimationEnd={() => setFlash(false)} />}
          </>
        )}
      </div>

      <div className="ff-cam__controls">
        <button className="ff-icon-btn" onClick={onCancel} aria-label="Close camera">
          <CloseIcon />
        </button>
        <button
          className="ff-shutter"
          onClick={capture}
          disabled={!ready || capturing || Boolean(error)}
          aria-label="Take selfie and search"
        >
          <span />
        </button>
        <button
          className="ff-icon-btn"
          onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          disabled={!multiCam || Boolean(error)}
          aria-label="Switch camera"
          title="Switch front / back camera"
        >
          <SwitchIcon />
        </button>
      </div>
    </div>
  )
}
