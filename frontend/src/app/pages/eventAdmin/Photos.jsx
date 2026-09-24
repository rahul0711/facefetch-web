import { CheckSquare, CircleAlert, CloudUpload, Images, LoaderCircle, RefreshCw, ScanFace, ScanSearch, Sparkles, Trash2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { FaceBox } from '../../components/Photo'
import Button from '../../components/ui/Button'
import { Modal, useToast } from '../../components/ui/overlay'
import { Badge, Checkbox, EmptyState, Progress, Segmented, Skeleton } from '../../components/ui/primitives'
import { useDocumentTitle, useQuery } from '../../lib/hooks'
import { cn, compact, num, timeAgo } from '../../lib/utils'
import { deletePhotos, listPhotos, reanalyze, uploadPhotos } from '../../services/photoService'
import { EventAdminHeader, EventHeaderSkeleton, Locked, NotAssigned, useAdminEvent } from './shared'

const PAGE = 48

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
      <ScanFace className="size-3 text-cyan-300" /> {p.faces.length} {p.faces.length === 1 ? 'face' : 'faces'}
    </span>
  )
}

export default function Photos() {
  const { ev, perms, loading, error, eventId } = useAdminEvent()
  useDocumentTitle(ev ? `Photos · ${ev.name}` : 'Photos')
  const toast = useToast()
  const { data: stored, loading: loadingPhotos } = useQuery(() => listPhotos(eventId), [eventId])
  const [live, setLive] = useState({}) // in-flight uploads, id -> record
  const [filter, setFilter] = useState('all')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [drag, setDrag] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [detail, setDetail] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [retrying, setRetrying] = useState(new Set())
  const [engine, setEngine] = useState(null)
  const input = useRef(null)
  const dragDepth = useRef(0)

  // Stored photos + in-flight uploads (in-flight wins until it lands).
  const photos = useMemo(() => {
    const byId = new Map((stored || []).map((p) => [p.id, p]))
    const inflight = Object.values(live).filter((r) => r.status === 'uploading' || r.status === 'analyzing' || !byId.has(r.id))
    inflight.forEach((r) => byId.delete(r.id))
    return [...inflight.reverse(), ...byId.values()].map((p) => (retrying.has(p.id) ? { ...p, status: 'analyzing' } : p))
  }, [stored, live, retrying])

  const counts = useMemo(() => {
    const c = { all: photos.length, processed: 0, analyzing: 0, failed: 0 }
    for (const p of photos) {
      if (p.status === 'processed') c.processed++
      else if (p.status === 'failed') c.failed++
      else c.analyzing++
    }
    return c
  }, [photos])

  const inflight = Object.values(live)
  const batchActive = inflight.some((r) => r.status === 'uploading' || r.status === 'analyzing')
  const batchDone = inflight.filter((r) => r.status === 'processed' || r.status === 'failed').length

  const onFiles = useCallback(
    async (fileList) => {
      if (!perms?.upload) return
      const files = [...fileList].filter((f) => f.type.startsWith('image/'))
      if (!files.length) {
        toast('Those files aren’t photos', { tone: 'error', description: 'Upload JPG, PNG or WEBP images.' })
        return
      }
      setFilter('all')
      await uploadPhotos(eventId, files, (rec) => {
        setLive((l) => ({ ...l, [rec.id]: rec }))
        if (rec.engine) setEngine(rec.engine)
      })
      toast(`${files.length} photo${files.length === 1 ? '' : 's'} added`, { description: 'Faces are indexed and ready for guest search.' })
    },
    [eventId, perms, toast],
  )

  const retry = async (list) => {
    setRetrying((s) => new Set([...s, ...list.map((p) => p.id)]))
    await Promise.all(list.map((p) => reanalyze(p.id)))
    setRetrying((s) => {
      const n = new Set(s)
      list.forEach((p) => n.delete(p.id))
      return n
    })
    toast(`${list.length} photo${list.length === 1 ? '' : 's'} re-analyzed`)
  }

  if (loading) return <EventHeaderSkeleton />
  if (error) return <NotAssigned />
  if (!perms.view) return <Locked what="view photos" />

  const shown = photos.filter((p) =>
    filter === 'all' ? true : filter === 'analyzing' ? p.status === 'analyzing' || p.status === 'uploading' : p.status === filter,
  )
  const failed = photos.filter((p) => p.status === 'failed')
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
        if (!perms.upload || !e.dataTransfer.types.includes('Files')) return
        dragDepth.current++
        setDrag(true)
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (!dragDepth.current) setDrag(false)
      }}
      onDragOver={(e) => perms.upload && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDrag(false)
        onFiles(e.dataTransfer.files)
      }}
    >
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
      <EventAdminHeader
        ev={ev}
        perms={perms}
        actions={
          <>
            {perms.manage && (
              <Button variant="secondary" onClick={() => retry(failed)} disabled={!failed.length || retrying.size > 0} title={failed.length ? 'Re-run face analysis on failed photos' : 'Every photo is analyzed'}>
                <ScanSearch /> {failed.length ? `Re-analyze ${failed.length}` : 'Analyze'}
              </Button>
            )}
            <Button onClick={() => input.current.click()} disabled={!perms.upload} title={perms.upload ? undefined : 'You don’t have upload access'}>
              <CloudUpload /> Upload photos
            </Button>
          </>
        }
      />

      {/* stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          ['Photos', ev.stats.photos, Images],
          ['Faces', ev.stats.faces, ScanFace],
          ['Searches', ev.stats.searches, ScanSearch],
        ].map(([label, v, Icon]) => (
          <div key={label} className="rounded-2xl border border-navy-100 bg-white p-4 shadow-card sm:p-5">
            <p className="flex items-center gap-1.5 text-[13px] text-navy-500">
              <Icon className="size-3.5" /> {label}
            </p>
            <p className="mt-1 text-2xl font-semibold text-navy-950 tabular-nums sm:text-[28px]">{num(v)}</p>
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
                  {engine && <> · {engine === 'facefetch' ? 'analyzed by the Genesis Hub AI engine' : 'simulated analysis (AI engine offline)'}</>}
                </p>
                <Progress value={batchDone / inflight.length} className="mt-3 h-1.5 bg-white/10" />
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
      {perms.upload && !inflight.length && (
        <button
          onClick={() => input.current.click()}
          className="group flex items-center gap-4 rounded-2xl border-2 border-dashed border-navy-200 bg-white/60 p-5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/40"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-transform group-hover:-translate-y-0.5">
            <CloudUpload className="size-6" />
          </span>
          <span>
            <span className="block font-semibold text-navy-900">
              <span className="[@media(pointer:coarse)]:hidden">Drag photos anywhere on this page, or click to browse</span>
              <span className="hidden [@media(pointer:coarse)]:inline">Tap to choose photos from your device</span>
            </span>
            <span className="block text-[13px] text-navy-500">JPG, PNG or WEBP · every face is detected and indexed automatically</span>
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
              {perms.manage && (
                <>
                  <Button size="sm" variant="secondary" disabled={!selected.size} onClick={() => retry(photos.filter((p) => selected.has(p.id)))}>
                    <RefreshCw /> Re-analyze
                  </Button>
                  <Button size="sm" variant="destructive-ghost" disabled={!selected.size} onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> Delete
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => (setSelecting(false), setSelected(new Set()))}>
                Done
              </Button>
            </>
          ) : (
            perms.manage && (
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
          title={photos.length ? (filter === 'failed' ? 'No failed photos' : 'Nothing here') : 'No photos uploaded yet'}
          className="rounded-2xl border border-navy-100 bg-white"
          action={!photos.length && perms.upload && <Button onClick={() => input.current.click()}><CloudUpload /> Upload the first photos</Button>}
        >
          {photos.length
            ? filter === 'failed'
              ? 'Every photo was analyzed successfully.'
              : 'No photos match this filter.'
            : 'Upload the event’s photos and Genesis Hub will index every face so guests can find themselves.'}
        </EmptyState>
      ) : (
        <>
          <p className="-mt-2 text-[13px] text-navy-500">
            Showing {Math.min(limit, shown.length)} of {shown.length} {filter === 'all' ? 'photos in the demo gallery' : 'photos'} ({compact(ev.stats.photos)} in the full event)
          </p>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            <AnimatePresence initial={false}>
              {shown.slice(0, limit).map((p) => {
                const sel = selected.has(p.id)
                return (
                  <motion.li key={p.id} layout initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25 }}>
                    <button
                      onClick={() => (selecting ? toggleSel(p.id) : p.src && setDetail(p))}
                      className={cn('group relative block aspect-square w-full overflow-hidden rounded-xl bg-navy-100 ring-2 transition', sel ? 'ring-brand-600' : 'ring-transparent')}
                      aria-label={selecting ? `Select ${p.alt}` : `Open ${p.alt}`}
                      aria-pressed={selecting ? sel : undefined}
                    >
                      {p.src ? (
                        <img src={p.src} alt={p.alt} loading="lazy" className={cn('size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]', sel && 'scale-[0.94] rounded-lg')} />
                      ) : (
                        <Skeleton className="size-full rounded-none" />
                      )}
                      <StatusOverlay p={p} onRetry={perms.manage && !selecting ? (x) => retry([x]) : null} />
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
          {shown.length > limit && (
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
              <img src={detail.src} alt={detail.alt} className="size-full object-cover" />
              {detail.faces.map((b, i) => (
                <FaceBox key={i} box={b} delay={i * 0.04} className="rounded-md border-[1.5px]" />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone={detail.status === 'failed' ? 'bad' : 'ok'} dot>
                {detail.status === 'failed' ? 'Analysis failed' : 'Processed'}
              </Badge>
              <Badge tone="brand">
                <ScanFace className="size-3" /> {detail.faces.length} faces detected
              </Badge>
              {detail.source === 'upload' && <Badge>Uploaded {timeAgo(detail.takenAt)}</Badge>}
              {detail.credit && <span className="text-[13px] text-navy-400">Photo: {detail.credit.name} / Unsplash</span>}
            </div>
          </div>
        )}
      </Modal>

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
                await deletePhotos([...selected])
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
