// Event photos (C# backend). The backend compresses each upload, stores it,
// and has the Python engine detect + index every face.
import { api, apiUpload, withToken } from './api'
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

/**
 * Lists a Google Drive folder (or single file) shared as "Anyone with the link".
 * -> { name, isFolder, truncated, skipped, files: [{ id, name, path, size, resourceKey, alreadyImported }] }
 */
export function listDriveFolder(eventId, url, includeSubfolders = true) {
  return api(`/api/eventadmin/${eventId}/drive/list`, { method: 'POST', json: { url: url.trim(), includeSubfolders } })
}

const DRIVE_BATCH = 4 // the server downloads each from Drive, then indexes it

/**
 * Imports Drive files a few at a time, with the same onUpdate(record) stream
 * as uploadPhotos: importing -> analyzing -> processed | failed | rejected.
 */
export async function importFromDrive(eventId, files, onUpdate) {
  const temp = files.map((f, i) => ({
    id: `drive-${Date.now()}-${i}`,
    name: f.path + f.name,
    alt: f.name,
    src: null,
    width: 4,
    height: 3,
    faceCount: 0,
    faces: [],
    status: 'uploading',
    progress: 0,
  }))
  temp.forEach((t) => onUpdate({ ...t }))

  const results = []
  for (let i = 0; i < files.length; i += DRIVE_BATCH) {
    const batch = files.slice(i, i + DRIVE_BATCH)
    const batchTemp = temp.slice(i, i + DRIVE_BATCH)
    batchTemp.forEach((t) => onUpdate({ ...t, status: 'analyzing', progress: 1 }))
    try {
      const res = await api(`/api/eventadmin/${eventId}/drive/import`, {
        method: 'POST',
        json: { files: batch.map((f) => ({ id: f.id, name: f.name, resourceKey: f.resourceKey || null })) },
      })
      res.forEach((r, j) => {
        const t = batchTemp[j]
        const status = r.status === 'Completed' ? 'processed' : r.status === 'Rejected' ? 'rejected' : 'failed'
        const src = r.photoId ? withToken(`/api/photos/${r.photoId}/thumbnail`) : null
        const rec = { ...t, src, realId: r.photoId, status, faceCount: r.faceCount, error: r.error, progress: 1 }
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
