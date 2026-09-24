import { useCallback, useEffect, useRef, useState } from 'react'
import { matchLabel } from './api'
import { buildZip, saveBlob } from './library'
import { ChevronIcon, CloseIcon, DownloadIcon, ImagesIcon, RetryIcon } from './icons'

const baseName = (name) => name.split('/').pop()

function FaceBox({ box }) {
  const [x1, y1, x2, y2] = box
  return (
    <span
      className="ff-facebox"
      style={{ left: `${x1 * 100}%`, top: `${y1 * 100}%`, width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%` }}
    />
  )
}

// Object URL for a photo's full-size original, read from IndexedDB on demand.
function useOriginalUrl(id, getOriginal) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let current = null
    let alive = true
    getOriginal(id).then((blob) => {
      if (!alive || !blob) return
      current = URL.createObjectURL(blob)
      setUrl(current)
    })
    return () => {
      alive = false
      setUrl(null)
      if (current) URL.revokeObjectURL(current)
    }
  }, [id, getOriginal])
  return url
}

function Lightbox({ matches, index, onClose, onIndex, getOriginal }) {
  const { photo, score, box } = matches[index]
  const fullUrl = useOriginalUrl(photo.id, getOriginal)
  const touchX = useRef(null)
  const [showBox, setShowBox] = useState(true)
  const go = useCallback(
    (d) => onIndex((index + d + matches.length) % matches.length),
    [index, matches.length, onIndex],
  )

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [go, onClose])

  const download = async () => {
    const blob = await getOriginal(photo.id)
    if (blob) saveBlob(blob, baseName(photo.name))
  }

  const label = matchLabel(score)
  return (
    <div
      className="ff-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.name}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        touchX.current = null
      }}
    >
      <div className="ff-lightbox__bar">
        <span className="ff-lightbox__count">
          {index + 1} / {matches.length}
        </span>
        <span className={`ff-badge ff-badge--${label.tone}`}>{label.text}</span>
        <div className="ff-lightbox__actions">
          <label className="ff-toggle">
            <input type="checkbox" checked={showBox} onChange={(e) => setShowBox(e.target.checked)} />
            Highlight face
          </label>
          <button className="ff-btn ff-btn--primary ff-btn--sm" onClick={download}>
            <DownloadIcon size={18} /> Download
          </button>
          <button className="ff-icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="ff-lightbox__stage" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {matches.length > 1 && (
          <button className="ff-lightbox__nav ff-lightbox__nav--prev" onClick={() => go(-1)} aria-label="Previous">
            <ChevronIcon dir="left" size={28} />
          </button>
        )}
        <div className="ff-lightbox__frame" key={photo.id} style={{ '--ar': photo.width / photo.height }}>
          {/* thumbnail first (instant), swapped for the original once read */}
          <img src={fullUrl || photo.thumbUrl} alt={photo.name} />
          {showBox && <FaceBox box={box} />}
        </div>
        {matches.length > 1 && (
          <button className="ff-lightbox__nav ff-lightbox__nav--next" onClick={() => go(1)} aria-label="Next">
            <ChevronIcon size={28} />
          </button>
        )}
      </div>
      <p className="ff-lightbox__name">{photo.name}</p>
    </div>
  )
}

export default function Results({ matches, stats, selfieUrl, getOriginal, onRetry }) {
  const [open, setOpen] = useState(null)
  const [zipping, setZipping] = useState(false)
  const stillAnalyzing = stats.pending > 0

  const downloadAll = async () => {
    setZipping(true)
    try {
      const files = []
      for (const m of matches) {
        const blob = await getOriginal(m.photo.id)
        if (blob) files.push({ name: m.photo.name, blob })
      }
      saveBlob(await buildZip(files), 'matched-photos.zip')
    } finally {
      setZipping(false)
    }
  }

  if (!matches.length) {
    return (
      <div className="ff-empty">
        <div className="ff-empty__avatar">
          {selfieUrl ? <img src={selfieUrl} alt="Your face photo" /> : <ImagesIcon size={30} />}
        </div>
        <h3>{stillAnalyzing ? 'No matches so far…' : 'No photos found'}</h3>
        <p>
          {stillAnalyzing
            ? `${stats.pending} photo${stats.pending === 1 ? ' is' : 's are'} still being analyzed. Matches will appear here automatically.`
            : `We checked ${stats.faces.toLocaleString()} faces in ${stats.done.toLocaleString()} photos and didn't find a confident match.`}
        </p>
        {!stillAnalyzing && (
          <ul className="ff-tips">
            <li>Face the camera straight on, without sunglasses or a mask</li>
            <li>Find brighter, even light, and avoid a window behind you</li>
            <li>Make sure the whole face fits in the oval</li>
          </ul>
        )}
        <button className="ff-btn ff-btn--primary" onClick={onRetry}>
          <RetryIcon size={18} /> Try another face
        </button>
      </div>
    )
  }

  return (
    <div className="ff-results">
      <div className="ff-results__head">
        <div className="ff-results__who">
          {selfieUrl && <img className="ff-results__selfie" src={selfieUrl} alt="Your face photo" />}
          <div>
            <h3>
              Found in {matches.length} photo{matches.length === 1 ? '' : 's'}
            </h3>
            <p>
              Out of {stats.done.toLocaleString()} analyzed · best matches first
              {stillAnalyzing && ` · ${stats.pending} still analyzing…`}
            </p>
          </div>
        </div>
        <div className="ff-results__actions">
          <button className="ff-btn ff-btn--ghost ff-btn--sm" onClick={onRetry}>
            <RetryIcon size={18} /> New search
          </button>
          <button className="ff-btn ff-btn--primary ff-btn--sm" onClick={downloadAll} disabled={zipping}>
            <DownloadIcon size={18} /> {zipping ? 'Preparing…' : 'Download all'}
          </button>
        </div>
      </div>

      <div className="ff-grid">
        {matches.map((m, i) => {
          const label = matchLabel(m.score)
          return (
            <button
              key={m.photo.id}
              className="ff-card"
              onClick={() => setOpen(i)}
              style={{ '--ar': `${m.photo.width} / ${m.photo.height}`, animationDelay: `${Math.min(i, 20) * 40}ms` }}
            >
              <img src={m.photo.thumbUrl} alt={m.photo.name} loading="lazy" />
              <FaceBox box={m.box} />
              <span className={`ff-badge ff-badge--${label.tone} ff-card__badge`}>{label.text}</span>
              {m.photo.faces.length > 1 && <span className="ff-card__group">+{m.photo.faces.length - 1} others</span>}
            </button>
          )
        })}
      </div>

      {open != null && open < matches.length && (
        <Lightbox
          matches={matches}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
          getOriginal={getOriginal}
        />
      )}
    </div>
  )
}
