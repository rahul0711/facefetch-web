import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { analyzePhoto } from './api'
import {
  addPhotoWithOriginal,
  clearLibrary,
  decodeEmbedding,
  deletePhotos,
  getOriginal,
  isImageFile,
  loadAllPhotos,
  prepareImage,
  putPhoto,
} from './library'

// Photos analyzed in parallel -- the server serializes GPU work anyway;
// this just keeps its queue fed while the browser decodes the next ones.
const CONCURRENCY = 3

// crypto.randomUUID only exists on secure origins; the site may be opened
// over plain http on a LAN.
const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

const fileSig = (f) => `${f.webkitRelativePath || f.name}|${f.size}|${f.lastModified}`

// Photo record (as stored in IndexedDB):
//   { id, name, sig, size, addedAt, status: 'pending'|'analyzing'|'done'|'error',
//     error?, width?, height?, thumb?: Blob, faces: [{ box, score, emb: Float32Array }] }
// In React state each record also gets `thumbUrl` (an object URL for thumb).
export function useLibrary() {
  const records = useRef(new Map()) // id -> record; source of truth
  const thumbUrls = useRef(new Map()) // id -> object URL
  const queue = useRef([])
  const active = useRef(0)
  const frame = useRef(0)
  const [photos, setPhotos] = useState([])
  const [loaded, setLoaded] = useState(false)
  const [storageError, setStorageError] = useState('')

  // Batch state updates to one per animation frame -- adding 500 photos
  // shouldn't mean 1500 re-renders.
  const commit = useCallback(() => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      setPhotos(
        [...records.current.values()].map((r) => {
          if (r.thumb && !thumbUrls.current.has(r.id)) thumbUrls.current.set(r.id, URL.createObjectURL(r.thumb))
          return { ...r, thumbUrl: thumbUrls.current.get(r.id) }
        }),
      )
    })
  }, [])

  const dropUrl = (id) => {
    const url = thumbUrls.current.get(id)
    if (url) URL.revokeObjectURL(url)
    thumbUrls.current.delete(id)
  }

  // Save + publish a record, unless it was deleted while we were working.
  const save = useCallback(
    async (rec) => {
      if (!records.current.has(rec.id)) return false
      records.current.set(rec.id, rec)
      commit()
      await putPhoto(rec)
      return true
    },
    [commit],
  )

  const process = useCallback(
    async (id) => {
      let rec = records.current.get(id)
      if (!rec) return
      try {
        const blob = await getOriginal(id)
        if (!blob) throw new Error('Original file missing')
        let prepared
        try {
          prepared = await prepareImage(blob)
        } catch {
          throw new Error("This browser can't read this image format")
        }
        rec = { ...rec, thumb: prepared.thumb, width: prepared.width, height: prepared.height, status: 'analyzing' }
        if (!(await save(rec))) return
        const res = await analyzePhoto(prepared.analyze)
        const faces = res.faces.map((f) => ({ box: f.box, score: f.score, emb: decodeEmbedding(f.embedding) }))
        await save({ ...rec, faces, status: 'done', error: undefined })
      } catch (e) {
        await save({ ...(records.current.get(id) || rec), status: 'error', error: e.message || 'Analysis failed' })
      }
    },
    [save],
  )

  const pump = useCallback(() => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const id = queue.current.shift()
      active.current++
      process(id).finally(() => {
        active.current--
        pump()
      })
    }
  }, [process])

  const enqueue = useCallback(
    (ids) => {
      queue.current.push(...ids)
      pump()
    },
    [pump],
  )

  // Load what's already in this browser, and resume anything unfinished
  // (e.g. the tab was closed mid-analysis).
  useEffect(() => {
    let cancelled = false
    loadAllPhotos()
      .then((rows) => {
        if (cancelled) return
        for (const r of rows) records.current.set(r.id, r.status === 'analyzing' ? { ...r, status: 'pending' } : r)
        commit()
        setLoaded(true)
        enqueue(rows.filter((r) => r.status === 'pending' || r.status === 'analyzing').map((r) => r.id))
      })
      .catch(() => {
        if (cancelled) return
        setStorageError('Browser storage is unavailable (private window?). Photos cannot be kept.')
        setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [commit, enqueue])

  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current)
      thumbUrls.current.forEach((u) => URL.revokeObjectURL(u))
    },
    [],
  )

  const addFiles = useCallback(
    async (fileList) => {
      const known = new Set([...records.current.values()].map((r) => r.sig))
      const files = [...fileList].filter((f) => isImageFile(f) && !known.has(fileSig(f)))
      if (!files.length) return 0
      navigator.storage?.persist?.().catch(() => {})
      const ids = []
      const base = Date.now()
      for (const [i, f] of files.entries()) {
        const rec = {
          id: newId(),
          name: f.webkitRelativePath || f.name,
          sig: fileSig(f),
          size: f.size,
          addedAt: base + i,
          status: 'pending',
          faces: [],
        }
        try {
          await addPhotoWithOriginal(rec, f)
        } catch {
          setStorageError('Browser storage is full. Remove some photos and try again.')
          break
        }
        records.current.set(rec.id, rec)
        ids.push(rec.id)
        commit()
      }
      enqueue(ids)
      return ids.length
    },
    [commit, enqueue],
  )

  const remove = useCallback(
    async (id) => {
      records.current.delete(id)
      queue.current = queue.current.filter((q) => q !== id)
      dropUrl(id)
      commit()
      await deletePhotos([id])
    },
    [commit],
  )

  const clear = useCallback(async () => {
    records.current.clear()
    queue.current = []
    thumbUrls.current.forEach((u) => URL.revokeObjectURL(u))
    thumbUrls.current.clear()
    commit()
    setStorageError('')
    await clearLibrary()
  }, [commit])

  const retryFailed = useCallback(() => {
    const failed = [...records.current.values()].filter((r) => r.status === 'error')
    for (const r of failed) records.current.set(r.id, { ...r, status: 'pending', error: undefined })
    commit()
    enqueue(failed.map((r) => r.id))
  }, [commit, enqueue])

  const stats = useMemo(() => {
    const s = { total: photos.length, done: 0, pending: 0, failed: 0, faces: 0 }
    for (const p of photos) {
      if (p.status === 'done') {
        s.done++
        s.faces += p.faces.length
      } else if (p.status === 'error') s.failed++
      else s.pending++
    }
    return s
  }, [photos])

  return { photos, stats, loaded, storageError, addFiles, remove, clear, retryFailed, getOriginal }
}
