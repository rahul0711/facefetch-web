import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { normalizeImage, queryEmbedding } from './api'
import CameraCapture from './CameraCapture'
import { decodeEmbedding, findMatches } from './library'
import Results from './Results'
import { CameraIcon, PhoneIcon, ShieldIcon, UploadIcon } from './icons'

// step: 'start' | 'camera' | 'searching' | 'results' | 'error'
export default function Finder({ ref, library }) {
  const { photos, stats } = library
  const [step, setStep] = useState('start')
  const [selfieUrl, setSelfieUrl] = useState(null)
  const [query, setQuery] = useState(null) // { emb: Float32Array, threshold }
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const uploadRef = useRef(null)
  const nativeCamRef = useRef(null)
  const rootRef = useRef(null)

  // Revoke the previous selfie preview whenever it's replaced/unmounted.
  useEffect(() => () => selfieUrl && URL.revokeObjectURL(selfieUrl), [selfieUrl])

  // Matching is local and cheap, so it's simply recomputed whenever the
  // library changes -- photos that finish analyzing after the search show
  // up in the results on their own.
  const matches = useMemo(
    () => (query ? findMatches(photos, query.emb, query.threshold) : []),
    [photos, query],
  )

  const scrollIntoView = () => rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  useImperativeHandle(ref, () => ({
    openCamera: () => {
      setStep('camera')
      scrollIntoView()
    },
    // Must run synchronously inside the click handler -- browsers only open
    // a file picker from a direct user gesture.
    openUpload: () => uploadRef.current?.click(),
  }))

  const runSearch = async (blobs) => {
    setSelfieUrl(URL.createObjectURL(blobs[0]))
    setStep('searching')
    scrollIntoView()
    try {
      const res = await queryEmbedding(blobs)
      setQuery({ emb: decodeEmbedding(res.embedding), threshold: res.match_threshold })
      setStep('results')
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.')
      setStep('error')
    }
  }

  const onFiles = async (fileList) => {
    const file = [...(fileList || [])].find((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    if (!file) return
    runSearch([await normalizeImage(file)])
  }

  const reset = () => {
    setQuery(null)
    setError('')
    setStep('start')
  }

  const libraryEmpty = stats.total === 0

  return (
    <div className="ff-finder" ref={rootRef}>
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = ''
        }}
      />
      {/* capture="user" makes phones open the front camera app directly --
          works even over plain http, where live getUserMedia is blocked. */}
      <input
        ref={nativeCamRef}
        type="file"
        accept="image/*"
        capture="user"
        hidden
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = ''
        }}
      />

      {step === 'start' && (
        <div
          className={`ff-start${dragging ? ' ff-start--drag' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            onFiles(e.dataTransfer.files)
          }}
        >
          <div className="ff-start__intro">
            <span className="ff-step-tag">Step 2</span>
            <h2>Show a face. Get every photo it's in.</h2>
            <p>
              Take a selfie, or upload a clear photo of the person you're looking for. We'll check every face in
              your library.
            </p>
            {libraryEmpty && <p className="ff-notice">Add some photos to your library first (Step 1).</p>}
          </div>
          <div className="ff-start__options">
            <button className="ff-option" onClick={() => setStep('camera')} disabled={libraryEmpty}>
              <span className="ff-option__icon">
                <CameraIcon size={26} />
              </span>
              <span className="ff-option__text">
                <strong>Use camera</strong>
                <small>Webcam or phone camera, front or back</small>
              </span>
            </button>
            <button className="ff-option" onClick={() => uploadRef.current?.click()} disabled={libraryEmpty}>
              <span className="ff-option__icon">
                <UploadIcon size={26} />
              </span>
              <span className="ff-option__text">
                <strong>Upload a face photo</strong>
                <small>Or drag &amp; drop it here</small>
              </span>
            </button>
            <button
              className="ff-option ff-option--mobile"
              onClick={() => nativeCamRef.current?.click()}
              disabled={libraryEmpty}
            >
              <span className="ff-option__icon">
                <PhoneIcon size={26} />
              </span>
              <span className="ff-option__text">
                <strong>Phone camera app</strong>
                <small>Snap with your phone's own camera</small>
              </span>
            </button>
          </div>
          <p className="ff-start__privacy">
            <ShieldIcon size={16} /> The face photo is only used for this search and is never saved.
          </p>
        </div>
      )}

      {step === 'camera' && (
        <CameraCapture
          onCapture={runSearch}
          onCancel={reset}
          onUseNativeCamera={() => nativeCamRef.current?.click()}
          onUpload={() => uploadRef.current?.click()}
        />
      )}

      {step === 'searching' && (
        <div className="ff-searching" role="status" aria-live="polite">
          <div className="ff-searching__face">
            {selfieUrl && <img src={selfieUrl} alt="" />}
            <span className="ff-searching__beam" />
            <span className="ff-searching__corners" />
          </div>
          <h3>Looking for this face…</h3>
          <p>Comparing against {stats.faces.toLocaleString()} faces in your library</p>
        </div>
      )}

      {step === 'error' && (
        <div className="ff-empty">
          <div className="ff-empty__avatar ff-empty__avatar--warn">
            {selfieUrl ? <img src={selfieUrl} alt="Your photo" /> : '!'}
          </div>
          <h3>Hmm, that didn't work</h3>
          <p>{error}</p>
          <div className="ff-row">
            <button className="ff-btn ff-btn--primary" onClick={() => setStep('camera')}>
              <CameraIcon size={18} /> Retake selfie
            </button>
            <button className="ff-btn ff-btn--ghost" onClick={() => uploadRef.current?.click()}>
              <UploadIcon size={18} /> Upload instead
            </button>
          </div>
        </div>
      )}

      {step === 'results' && query && (
        <Results
          matches={matches}
          stats={stats}
          selfieUrl={selfieUrl}
          getOriginal={library.getOriginal}
          onRetry={reset}
        />
      )}
    </div>
  )
}
