// Event photos (C# backend). The backend compresses each upload, stores it,
// and has the Python engine detect + index every face.
import { api, apiUpload } from './api'
import { toPhoto } from './adapters'
import { emitChange } from './bus'

export async function listPhotos(eventId, { status, page = 1, pageSize = 60 } = {}) {
  const q = new URLSearchParams({ page, pageSize })
  if (status) q.set('status', status)
  const r = await api(`/api/eventadmin/${eventId}/photos?${q}`)
  return { items: r.items.map(toPhoto), total: r.total, page: r.page, pageSize: r.pageSize }
}

export async function getPhoto(photoId) {
  return toPhoto(await api(`/api/photos/${photoId}`))
}

const BATCH = 4 // files per request: keeps progress granular and requests short

/**
 * Uploads files in small batches. onUpdate(record) fires for every change:
 * uploading(progress) -> analyzing -> processed | failed | rejected.
 */
export async function uploadPhotos(eventId, files, onUpdate) {
  const temp = files.map((f, i) => ({
    id: `tmp-${Date.now()}-${i}`,
    name: f.name,
    alt: f.name,
    src: URL.createObjectURL(f),
    width: 4,
    height: 3,
    faceCount: 0,
    faces: [],
    status: 'uploading',
    progress: 0,
  }))
  temp.forEach((t) => onUpdate({ ...t }))

  const results = []
  for (let i = 0; i < files.length; i += BATCH) {
    const batchFiles = files.slice(i, i + BATCH)
    const batchTemp = temp.slice(i, i + BATCH)
    const form = new FormData()
    batchFiles.forEach((f) => form.append('files', f, f.name))
    try {
      const res = await apiUpload(`/api/eventadmin/${eventId}/photos`, form, (p) => {
        batchTemp.forEach((t) => onUpdate({ ...t, progress: p, status: p >= 1 ? 'analyzing' : 'uploading' }))
      })
      res.forEach((r, j) => {
        const t = batchTemp[j]
        const status = r.status === 'Completed' ? 'processed' : r.status === 'Rejected' ? 'rejected' : 'failed'
        const rec = { ...t, realId: r.photoId, status, faceCount: r.faceCount, error: r.error, progress: 1 }
        onUpdate(rec)
        results.push(rec)
      })
    } catch (e) {
      batchTemp.forEach((t) => {
        const rec = { ...t, status: 'failed', error: e.message }
        onUpdate(rec)
        results.push(rec)
      })
    }
  }
  emitChange()
  return results
}

export async function reanalyze(eventId, photoId) {
  const r = await api(`/api/eventadmin/${eventId}/photos/${photoId}/reanalyze`, { method: 'POST' })
  emitChange()
  return r
}

export async function reanalyzeFailed(eventId) {
  const r = await api(`/api/eventadmin/${eventId}/photos/reanalyze-failed`, { method: 'POST' })
  emitChange()
  return r
}

export async function deletePhotos(eventId, ids) {
  const r = await api(`/api/eventadmin/${eventId}/photos/bulk-delete`, { method: 'POST', json: { photoIds: ids } })
  emitChange()
  return r
}
