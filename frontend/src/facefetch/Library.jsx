import { useImperativeHandle, useRef, useState } from 'react'
import { CloseIcon, FolderIcon, ImagesIcon, RetryIcon, UploadIcon } from './icons'

// Grid shows this many thumbnails until "Show all" -- keeps huge libraries snappy.
const PREVIEW_COUNT = 48

function Thumb({ photo, onRemove }) {
  const faces = photo.faces.length
  return (
    <div className={`ff-lib__item ff-lib__item--${photo.status}`} title={photo.error || photo.name}>
      {photo.thumbUrl ? <img src={photo.thumbUrl} alt={photo.name} loading="lazy" /> : <span className="ff-skeleton" />}
      {(photo.status === 'pending' || photo.status === 'analyzing') && (
        <span className="ff-lib__state">
          <span className="ff-spinner" />
        </span>
      )}
      {photo.status === 'done' && (
        <span className={`ff-lib__faces${faces ? '' : ' ff-lib__faces--none'}`}>
          {faces ? `${faces} face${faces > 1 ? 's' : ''}` : 'no faces'}
        </span>
      )}
      {photo.status === 'error' && <span className="ff-lib__state ff-lib__state--error">!</span>}
      <button className="ff-lib__remove" onClick={() => onRemove(photo.id)} aria-label={`Remove ${photo.name}`}>
        <CloseIcon size={14} />
      </button>
    </div>
  )
}

export default function Library({ ref, library }) {
  const { photos, stats, loaded, storageError, addFiles, remove, clear, retryFailed } = library
  const filesRef = useRef(null)
  const folderRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [notice, setNotice] = useState('')

  useImperativeHandle(ref, () => ({
    // Must run synchronously inside a click handler (user gesture).
    openPicker: () => filesRef.current?.click(),
  }))

  const add = async (files) => {
    const count = files?.length ?? 0
    const added = await addFiles(files || [])
    setNotice(
      count && added < count
        ? `Added ${added} photo${added === 1 ? '' : 's'} (skipped ${count - added} duplicate or non-image file${count - added === 1 ? '' : 's'})`
        : '',
    )
  }

  const onInput = (e) => {
    add(e.target.files)
    e.target.value = ''
  }

  const firstError = stats.failed ? photos.find((p) => p.status === 'error')?.error : ''
  const progress = stats.total ? Math.round(((stats.done + stats.failed) / stats.total) * 100) : 0
  const newestFirst = [...photos].reverse()
  const visible = showAll ? newestFirst : newestFirst.slice(0, PREVIEW_COUNT)

  return (
    <div
      className={`ff-lib${dragging ? ' ff-lib--drag' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => e.currentTarget.contains(e.relatedTarget) || setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        add(e.dataTransfer.files)
      }}
    >
      <input ref={filesRef} type="file" accept="image/*" multiple hidden onChange={onInput} />
      <input ref={folderRef} type="file" webkitdirectory="" directory="" multiple hidden onChange={onInput} />

      <div className="ff-panel__head">
        <div>
          <span className="ff-step-tag">Step 1</span>
          <h2>Your photo library</h2>
          <p className="ff-panel__sub">
            {stats.total
              ? `${stats.total.toLocaleString()} photo${stats.total === 1 ? '' : 's'} · ${stats.faces.toLocaleString()} faces found`
              : 'Photos are kept in this browser only, until you clear them.'}
          </p>
        </div>
        <div className="ff-panel__actions">
          <button className="ff-btn ff-btn--primary ff-btn--sm" onClick={() => filesRef.current?.click()}>
            <UploadIcon size={18} /> Add photos
          </button>
          <button className="ff-btn ff-btn--ghost ff-btn--sm ff-hide-touch" onClick={() => folderRef.current?.click()}>
            <FolderIcon size={18} /> Add folder
          </button>
          {stats.total > 0 && (
            <button
              className="ff-btn ff-btn--ghost ff-btn--sm ff-btn--danger"
              onClick={() => window.confirm(`Remove all ${stats.total} photos from this browser?`) && clear()}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {stats.pending > 0 && (
        <div className="ff-progress" role="status">
          <div className="ff-progress__label">
            <span>
              <span className="ff-spinner ff-spinner--sm" /> Analyzing faces… {stats.done + stats.failed} of {stats.total}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="ff-progress__bar">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {(storageError || notice || stats.failed > 0) && (
        <div className="ff-lib__notices">
          {storageError && <p className="ff-notice ff-notice--bad">{storageError}</p>}
          {notice && <p className="ff-notice">{notice}</p>}
          {stats.failed > 0 && stats.pending === 0 && (
            <p className="ff-notice ff-notice--bad">
              {stats.failed} photo{stats.failed === 1 ? '' : 's'} couldn't be analyzed
              {firstError ? `: ${firstError}` : '.'}
              <button className="ff-link" onClick={retryFailed}>
                <RetryIcon size={14} /> Retry
              </button>
            </p>
          )}
        </div>
      )}

      {!loaded ? (
        <div className="ff-lib__empty">
          <span className="ff-spinner" />
        </div>
      ) : stats.total === 0 ? (
        <button className="ff-lib__empty ff-lib__drop" onClick={() => filesRef.current?.click()}>
          <span className="ff-lib__drop-icon">
            <ImagesIcon size={30} />
          </span>
          <strong>Drop photos here, or click to choose</strong>
          <small>Add as many as you like: event shots, group photos, a whole folder. JPG, PNG, WEBP.</small>
        </button>
      ) : (
        <>
          <div className="ff-lib__grid">
            {visible.map((p) => (
              <Thumb key={p.id} photo={p} onRemove={remove} />
            ))}
          </div>
          {photos.length > PREVIEW_COUNT && (
            <button className="ff-link ff-lib__more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Show fewer' : `Show all ${photos.length.toLocaleString()} photos`}
            </button>
          )}
        </>
      )}
      {dragging && (
        <div className="ff-lib__dropmask">
          <UploadIcon size={34} />
          Drop to add photos
        </div>
      )}
    </div>
  )
}
