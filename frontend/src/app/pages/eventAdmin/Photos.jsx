import { CheckSquare, CircleAlert, CloudUpload, FolderUp, Images, LoaderCircle, RefreshCw, ScanFace, ScanSearch, Sparkles, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { FaceBox } from '../../components/Photo'
import Button from '../../components/ui/Button'
import { Modal, useToast } from '../../components/ui/overlay'
import { Badge, Checkbox, EmptyState, Progress, Segmented, Skeleton } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { cn, fileSize, num, timeAgo } from '../../lib/utils'
import { eventStats } from '../../services/analyticsService'
import { deletePhotos, getPhoto, importFromDrive, listPhotos, reanalyze, reanalyzeFailed, uploadPhotos } from '../../services/photoService'
import DriveIcon from '../../components/ui/DriveIcon'
import DriveImportDialog from './DriveImport'
import { EventAdminHeader, EventHeaderSkeleton, Locked, NotAssigned, useAdminEvent } from './shared'

const PAGE = 48
const STATUS_PARAM = { all: undefined, processed: 'Completed', analyzing: 'Processing', failed: 'Failed' }
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i

// Files from a folder picker can arrive without a MIME type, so fall back to
// the extension. Hidden files (.DS_Store, ._foo.jpg) are skipped.
const isImage = (f) => !f.name.startsWith('.') && (f.type.startsWith('image/') || IMAGE_EXT.test(f.name))

// Every file in a drop, walking into dropped folders (and their subfolders).
// The entries must be taken synchronously, before the drop event ends.
async function droppedFiles(dt) {
  const entries = [...(dt.items || [])].map((it) => it.webkitGetAsEntry?.()).filter(Boolean)
  if (!entries.length) return [...dt.files]
  const out = []
  const walk = async (entry) => {
    if (entry.isFile) {
      out.push(await new Promise((res, rej) => entry.file(res, rej)))
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      // readEntries returns at most ~100 entries per call
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej))
        if (!batch.length) break
        for (const e of batch) await walk(e)
      }
    }
  }
  for (const e of entries) await walk(e)
  return out
}

function StatusOverlay({ p, onRetry }) {
  if (p.status === 'uploading')
    return (
      <div className="absolute inset-0 flex flex-col justify-end bg-navy-950/55 p-2.5">
        <span className="mb-1.5 text-[11px] font-medium text-white tabular-nums">Uploading {Math.round((p.progress || 0) * 100)}%</span>
        <Progress value={p.progress || 0} className="h-1 bg-white/20" />
      </div>
    )
  if (p.status === 'analyzing')
    return (
      <div className="absolute inset-0 overflow-hidden bg-navy-950/35">
        <span className="absolute inset-x-0 top-0 h-1/3 animate-scan bg-gradient-to-b from-transparent to-cyan-300/60" />
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-navy-950/70 px-2 py-0.5 text-[11px] font-medium text-cyan-200 backdrop-blur">
          <LoaderCircle className="size-3 animate-spin" /> Analyzing
        </span>
      </div>
    )
  if (p.status === 'failed')
    return (
      <div className="absolute inset-0 flex flex-col items-start justify-end bg-gradient-to-t from-red-950/70 to-transparent p-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-red-700">
          <CircleAlert className="size-3" /> Failed
        </span>
        {onRetry && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRetry(p)
            }}
            className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-navy-950/70 px-2 py-1 text-[11px] font-medium text-white hover:bg-navy-950"
          >
            <RefreshCw className="size-3" /> Retry
          </button>
        )}
      </div>
    )
  return (
    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-navy-950/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
      <ScanFace className="size-3 text-cyan-300" /> {p.faceCount} {p.faceCount === 1 ? 'face' : 'faces'}
    </span>
  )
}

export default function Photos() {
  const { ev, perms, loading, error, eventId } = useAdminEvent()
  useDocumentTitle(ev ? `Photos · ${ev.name}` : 'Photos')
  const toast = useToast()
  const [filter, setFilter] = useState('all')
  const [limit, setLimit] = useState(PAGE)
  const { data: page, loading: loadingPhotos } = useQuery(
    () => listPhotos(eventId, { status: STATUS_PARAM[filter], pageSize: limit }),
    [eventId, filter, limit],
  )
  const stored = page?.items
  const { data: stats } = useQuery(() => eventStats(eventId), [eventId])
  const [live, setLive] = useState({}) // this session's uploads, temp id -> record
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [drag, setDrag] = useState(false)
  const [detail, setDetail] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [retrying, setRetrying] = useState(new Set())
  const [driveOpen, setDriveOpen] = useState(false)
  const input = useRef(null)
  const folderInput = useRef(null)
  const dragDepth = useRef(0)

  // Stored photos, with this session's still-running uploads in front.
  const photos = useMemo(() => {
    const running = filter === 'all' || filter === 'analyzing' ? Object.values(live).filter((r) => r.status === 'uploading' || r.status === 'analyzing') : []
    return [...running.reverse(), ...(stored || [])].map((p) => (retrying.has(p.id) ? { ...p, status: 'analyzing' } : p))
  }, [stored, live, retrying, filter])

  const counts = {
    all: stats?.photos ?? 0,
    processed: stats?.photosCompleted ?? 0,
    analyzing: (stats?.photosPending ?? 0) + (stats?.photosProcessing ?? 0),
    failed: stats?.photosFailed ?? 0,
  }
  const total = (page?.total ?? 0) + photos.filter((p) => typeof p.id === 'string').length

  const inflight = Object.values(live)
  const batchActive = inflight.some((r) => r.status === 'uploading' || r.status === 'analyzing')
  const batchDone = inflight.filter((r) => r.status === 'processed' || r.status === 'failed' || r.status === 'rejected').length
  const rejected = inflight.filter((r) => r.status === 'rejected' || (r.status === 'failed' && !r.realId))

  // Runs an upload or a Drive import through the progress panel, then sums it up.
  const runBatch = useCallback(
    async (start) => {
      setFilter('all')
      setLive({})
      const res = await start((rec) => setLive((l) => ({ ...l, [rec.id]: rec })))
      const ok = res.filter((r) => r.status === 'processed').length
      const bad = res.length - ok
      toast(`${ok} of ${res.length} photo${res.length === 1 ? '' : 's'} indexed`, {
        tone: bad ? 'info' : 'success',
        description: bad ? `${bad} couldn’t be added. See the list below.` : 'Faces are indexed and ready for guest search.',
      })
    },
    [toast],
  )

  const onFiles = useCallback(
    (fileList) => {
      if (!perms?.canUpload) return
      const files = [...fileList].filter(isImage).sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name))
      if (!files.length) {
        toast('Those files aren’t photos', { tone: 'error', description: 'Upload JPG, PNG or WEBP images.' })
        return
      }
      runBatch((onUpdate) => uploadPhotos(eventId, files, onUpdate))
    },
    [eventId, perms, toast, runBatch],
  )

  const onDriveImport = useCallback((files) => runBatch((onUpdate) => importFromDrive(eventId, files, onUpdate)), [eventId, runBatch])

  const retry = async (list) => {
    setRetrying((s) => new Set([...s, ...list.map((p) => p.id)]))
    let ok = 0
    for (const p of list) {
      try {
        if ((await reanalyze(eventId, p.id)).status === 'Completed') ok++
      } catch {
        // counted as not recovered
      }
    }
    setRetrying((s) => {
      const n = new Set(s)
      list.forEach((p) => n.delete(p.id))
      return n
    })
    toast(`${ok} of ${list.length} photo${list.length === 1 ? '' : 's'} analyzed`, { tone: ok === list.length ? 'success' : 'info' })
  }

  const retryAllFailed = async () => {
    setRetrying(new Set(['*']))
    try {
      const r = await reanalyzeFailed(eventId)
      toast(`${r.filter((x) => x.status === 'Completed').length} of ${r.length} failed photos recovered`)
    } catch (e) {
      toast(e.message, { tone: 'error' })
    } finally {
      setRetrying(new Set())
    }
  }

  const openDetail = async (p) => {
    setDetail({ ...p, loadingFaces: true })
    try {
      setDetail(await getPhoto(p.id))
    } catch {
      setDetail({ ...p, loadingFaces: false })
    }
  }

  if (loading) return <EventHeaderSkeleton />
  if (error || !ev) return <NotAssigned />
  if (!perms.canView) return <Locked what="view photos" />

  const shown = photos
  const canFix = perms.canUpload || perms.canManage
  const toggleSel = (id) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  return (
    <div
      className="relative grid gap-6"
      onDragEnter={(e) => {
        if (!perms.canUpload || !e.dataTransfer.types.includes('Files')) return
        dragDepth.current++
        setDrag(true)
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDrag(false)
      }}
      onDragOver={(e) => perms.canUpload && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDrag(false)
        if (!perms.canUpload) return
        droppedFiles(e.dataTransfer).then(onFiles, () => onFiles(e.dataTransfer.files))
      }}
    >
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
      <input ref={folderInput} type="file" webkitdirectory="" directory="" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
      <EventAdminHeader
        ev={ev}
        perms={perms}
        actions={
          <>
            {canFix && counts.failed > 0 && (
              <Button variant="secondary" onClick={retryAllFailed} loading={retrying.has('*')} disabled={retrying.size > 0} title="Re-run face analysis on every failed photo">
                <ScanSearch /> Re-analyze {counts.failed} failed
              </Button>
            )}
            <Button onClick={() => input.current.click()} disabled={!perms.canUpload} title={perms.canUpload ? undefined : 'You don’t have upload access'}>
              <CloudUpload /> Upload photos
            </Button>
            <Button variant="secondary" onClick={() => folderInput.current.click()} disabled={!perms.canUpload} title={perms.canUpload ? 'Upload every photo in a folder, including subfolders' : 'You don’t have upload access'}>
              <FolderUp /> Upload folder
            </Button>
            <Button variant="secondary" onClick={() => setDriveOpen(true)} disabled={!perms.canUpload || batchActive} title={perms.canUpload ? 'Import a shared Google Drive folder' : 'You don’t have upload access'}>
              <DriveIcon /> Google Drive
            </Button>
          </>
        }
      />

      {/* stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          ['Photos', stats?.photos, Images],
          ['Faces', stats?.faces, ScanFace],
          ['Searches', stats?.searches, ScanSearch],
        ].map(([label, v, Icon]) => (
          <div key={label} className="rounded-2xl border border-navy-100 bg-white p-4 shadow-card sm:p-5">
            <p className="flex items-center gap-1.5 text-[13px] text-navy-500">
              <Icon className="size-3.5" /> {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-navy-950 tabular-nums sm:text-[28px]">{v == null ? '—' : num(v)}</p>
          </div>
        ))}
      </div>

      {/* upload / processing panel */}
      <AnimatePresence>
        {inflight.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl bg-navy-950 text-white"
          >
            <div className="flex flex-wrap items-center gap-4 p-5">
              <span className={cn('grid size-11 place-items-center rounded-xl', batchActive ? 'bg-brand-600' : 'bg-emerald-500')}>
                {batchActive ? <LoaderCircle className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {batchActive ? `Processing ${inflight.length} photo${inflight.length === 1 ? '' : 's'}…` : `${inflight.length} photo${inflight.length === 1 ? '' : 's'} ready for guest search`}
                </p>
                <p className="text-[13px] text-navy-300">
                  {inflight.filter((r) => r.status === 'uploading').length} uploading · {inflight.filter((r) => r.status === 'analyzing').length} analyzing · {batchDone} done
                </p>
                <Progress value={batchDone / inflight.length} className="mt-3 h-1.5 bg-white/10" />
                {!batchActive && rejected.length > 0 && (
                  <ul className="mt-3 grid max-h-32 gap-1 overflow-y-auto text-[12px] text-red-200">
                    {rejected.map((r) => (
                      <li key={r.id} className="truncate">
                        <CircleAlert className="mr-1 inline size-3" /> {r.name}: {r.error || 'not stored'}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {!batchActive && (
                <button onClick={() => setLive({})} className="grid size-9 place-items-center rounded-lg text-navy-300 hover:bg-white/10 hover:text-white" aria-label="Dismiss">
                  <X className="size-4" />
                </button>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* drop zone */}
      {perms.canUpload && !inflight.length && (
        <button
          onClick={() => input.current.click()}
          className="group flex items-center gap-4 rounded-2xl border-2 border-dashed border-navy-200 bg-white/60 p-5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/40"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-transform group-hover:-translate-y-0.5">
            <CloudUpload className="size-6" />
          </span>
          <span>
            <span className="block font-semibold text-navy-900">
              <span className="[@media(pointer:coarse)]:hidden">Drag photos or a whole folder anywhere on this page, or click to browse</span>
              <span className="hidden [@media(pointer:coarse)]:inline">Tap to choose photos from your device</span>
            </span>
            <span className="block text-[13px] text-navy-500">JPG, PNG or WEBP · every face is detected and indexed automatically · photos on Google Drive? Use the Google Drive button</span>
          </span>
        </button>
      )}

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="scrollbar-none -my-1 max-w-full overflow-x-auto py-1">
          <Segmented
            label="Filter by status"
            size="sm"
            value={filter}
            onChange={(v) => (setFilter(v), setLimit(PAGE))}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'processed', label: 'Processed', count: counts.processed },
              { value: 'analyzing', label: 'In progress', count: counts.analyzing },
              { value: 'failed', label: 'Failed', count: counts.failed },
            ]}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selecting ? (
            <>
              <span className="text-sm text-navy-500">{selected.size} selected</span>
              {canFix && (
                <Button size="sm" variant="secondary" disabled={!selected.size} onClick={() => retry(photos.filter((p) => selected.has(p.id)))}>
                  <RefreshCw /> Re-analyze
                </Button>
              )}
              {perms.canDelete && (
                <Button size="sm" variant="destructive-ghost" disabled={!selected.size} onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Delete
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => (setSelecting(false), setSelected(new Set()))}>
                Done
              </Button>
            </>
          ) : (
            (canFix || perms.canDelete) && (
              <Button size="sm" variant="ghost" onClick={() => setSelecting(true)} disabled={!photos.length}>
                <CheckSquare /> Manage photos
              </Button>
            )
          )}
        </div>
      </div>

      {/* grid */}
      {loadingPhotos && !stored ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 12 }, (_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      ) : !shown.length ? (
        <EmptyState
          icon={filter === 'failed' ? Sparkles : Images}
          title={counts.all ? (filter === 'failed' ? 'No failed photos' : 'Nothing here') : 'No photos uploaded yet'}
          className="rounded-2xl border border-navy-100 bg-white"
          action={!counts.all && perms.canUpload && <Button onClick={() => input.current.click()}><CloudUpload /> Upload the first photos</Button>}
        >
          {counts.all
            ? filter === 'failed'
              ? 'Every photo was analyzed successfully.'
              : 'No photos match this filter.'
            : 'Upload the event’s photos and Genesis Hub will index every face so guests can find themselves.'}
        </EmptyState>
      ) : (
        <>
          <p className="-mt-2 text-[13px] text-navy-500">
            Showing {shown.length} of {num(total)} photos
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            <AnimatePresence initial={false}>
              {shown.map((p) => {
                const sel = selected.has(p.id)
                return (
                  <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }}>
                    <button
                      onClick={() => (selecting ? typeof p.id === 'number' && toggleSel(p.id) : typeof p.id === 'number' && openDetail(p))}
                      className={cn('group relative block aspect-square w-full overflow-hidden rounded-xl bg-navy-100 ring-2 transition', sel ? 'ring-brand-600' : 'ring-transparent')}
                      aria-label={selecting ? `Select ${p.alt}` : `Open ${p.alt}`}
                      aria-pressed={selecting ? sel : undefined}
                    >
                      {p.src ? (
                        <img src={p.src} alt={p.alt} loading="lazy" className={cn('size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]', sel && 'scale-[0.94] rounded-lg')} />
                      ) : (
                        <Skeleton className="size-full rounded-none" />
                      )}
                      <StatusOverlay p={p} onRetry={canFix && !selecting && typeof p.id === 'number' ? (x) => retry([x]) : null} />
                      {selecting && (
                        <span className="absolute top-2 left-2">
                          <Checkbox checked={sel} onChange={() => toggleSel(p.id)} label={`Select photo`} tabIndex={-1} />
                        </span>
                      )}
                    </button>
                  </motion.li>
                )
              })}
            </AnimatePresence>
          </ul>
          {page && page.total > limit && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
                Show more photos
              </Button>
            </div>
          )}
        </>
      )}

      {/* page-wide drop overlay */}
      <AnimatePresence>
        {drag && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-navy-950/60 backdrop-blur-sm lg:left-64">
            <div className="grid justify-items-center rounded-3xl border-2 border-dashed border-cyan-300 bg-navy-950/80 px-14 py-12 text-center text-white">
              <CloudUpload className="size-10 text-cyan-300" />
              <p className="mt-4 text-xl font-semibold">Drop to upload to {ev.name}</p>
              <p className="mt-1 text-sm text-navy-300">Faces are detected automatically</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.alt || 'Photo'} size="lg">
        {detail && (
          <div className="grid gap-4">
            <div className="relative overflow-hidden rounded-xl bg-navy-950" style={{ aspectRatio: `${detail.width} / ${detail.height}` }}>
              <img src={detail.full || detail.src} alt={detail.alt} className="size-full object-cover" />
              {(detail.faces || []).map((b, i) => (
                <FaceBox key={i} box={b} delay={i * 0.04} className="rounded-md border-[1.5px]" />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={detail.status === 'failed' ? 'bad' : 'ok'} dot>
                {detail.status === 'failed' ? 'Analysis failed' : 'Processed'}
              </Badge>
              <Badge tone="brand">
                <ScanFace className="size-3" /> {detail.faceCount} faces detected
              </Badge>
              <Badge>Uploaded {timeAgo(detail.takenAt)}</Badge>
              {detail.uploadedByName && <span className="text-[13px] text-navy-500">by {detail.uploadedByName}</span>}
              {detail.fileSize > 0 && <span className="text-[13px] text-navy-400">{fileSize(detail.fileSize)}</span>}
              {detail.error && <p className="w-full text-[13px] text-bad">{detail.error}</p>}
            </div>
          </div>
        )}
      </Modal>

      <DriveImportDialog eventId={eventId} open={driveOpen} onClose={() => setDriveOpen(false)} onImport={onDriveImport} />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${selected.size} photo${selected.size === 1 ? '' : 's'}?`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                await deletePhotos(eventId, [...selected])
                toast(`${selected.size} photo${selected.size === 1 ? '' : 's'} deleted`)
                setSelected(new Set())
                setConfirmDelete(false)
                setSelecting(false)
              }}
            >
              <Trash2 /> Delete
            </Button>
          </>
        }
      >
        <p className="text-navy-600">Guests won’t find these photos in search anymore. This can’t be undone.</p>
      </Modal>
    </div>
  )
}
