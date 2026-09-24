// Event photos. Seed photos are real images with real face boxes; uploads
// made in the demo are analyzed by the real Genesis Hub engine
// (POST /api/analyze) when the backend is running, and by a timer-driven
// mock when it isn't.
import { commit, db, delay, uid } from './db'

// GET /events/:id/photos
export async function listPhotos(eventId) {
  await delay(400)
  return db()
    .photos.filter((p) => p.eventId === eventId)
    .sort((a, b) => b.takenAt.localeCompare(a.takenAt))
}

export async function getPhoto(photoId) {
  await delay(150)
  const p = db().photos.find((x) => x.id === photoId)
  if (!p) throw new Error('Photo not found')
  return p
}

async function makeThumb(file, maxSide = 640) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close?.()
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.72))
  const dataUrl = await new Promise((r) => {
    const fr = new FileReader()
    fr.onload = () => r(fr.result)
    fr.readAsDataURL(blob)
  })
  return { blob, dataUrl, width: canvas.width, height: canvas.height }
}

async function realAnalyze(blob) {
  const fd = new FormData()
  fd.append('image', blob, 'photo.jpg')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch('/api/analyze', { method: 'POST', body: fd, signal: ctrl.signal })
    if (!res.ok) return null
    const body = await res.json()
    return body.faces.map((f) => f.box)
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

function mockFaces(seed) {
  let s = seed
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
  const n = Math.floor(r() * 4) + (r() < 0.12 ? 0 : 1)
  return Array.from({ length: n }, () => {
    const w = 0.08 + r() * 0.1
    const x = 0.1 + r() * 0.75
    const y = 0.12 + r() * 0.4
    return [x, y, Math.min(1, x + w), Math.min(1, y + w * 1.3)]
  })
}

// POST /events/:id/photos -- uploads a batch, then analyzes each photo.
// onUpdate(record) is called on every state change so the grid can animate:
// uploading(progress) -> analyzing -> processed | failed
export async function uploadPhotos(eventId, files, onUpdate) {
  const records = files.map((f) => ({
    id: uid('ph'),
    eventId,
    src: null,
    width: 4,
    height: 3,
    alt: f.name,
    name: f.name,
    faces: [],
    takenAt: new Date().toISOString(),
    status: 'uploading',
    progress: 0,
    source: 'upload',
  }))
  records.forEach((r) => onUpdate({ ...r }))

  const work = records.map(async (rec, i) => {
    try {
      const thumb = await makeThumb(files[i])
      Object.assign(rec, { src: thumb.dataUrl, width: thumb.width, height: thumb.height })
      // simulated upload progress
      for (let p = 0.15; p < 1; p += 0.2 + Math.random() * 0.25) {
        rec.progress = Math.min(p, 0.95)
        onUpdate({ ...rec })
        await delay(120)
      }
      rec.status = 'analyzing'
      rec.progress = 1
      onUpdate({ ...rec })
      const [real] = await Promise.all([realAnalyze(thumb.blob), delay(900 + Math.random() * 900)])
      rec.faces = real ?? mockFaces(i + thumb.width)
      rec.status = 'processed'
      rec.engine = real ? 'facefetch' : 'mock'
    } catch {
      rec.status = 'failed'
    }
    onUpdate({ ...rec })
    commit((d) => {
      d.photos.push({ ...rec })
      const ev = d.events.find((e) => e.id === eventId)
      if (rec.status === 'processed') {
        ev.stats.photos += 1
        ev.stats.faces += rec.faces.length
      }
    })
  })
  await Promise.all(work)
  const me = db().events.find((e) => e.id === eventId)
  commit((d) => {
    d.activity.unshift({
      id: uid('act'),
      kind: 'upload',
      text: `${files.length} photo${files.length === 1 ? '' : 's'} uploaded`,
      event: me?.name,
      at: new Date().toISOString(),
    })
  })
}

// POST /photos/:id/reanalyze
export async function reanalyze(photoId) {
  await delay(1400)
  commit((d) => {
    const p = d.photos.find((x) => x.id === photoId)
    p.status = 'processed'
    if (!p.faces.length) p.faces = mockFaces(photoId.length * 17)
  })
  return db().photos.find((x) => x.id === photoId)
}

// DELETE /photos/:id
export async function deletePhotos(ids) {
  await delay(300)
  const set = new Set(ids)
  commit((d) => {
    d.photos = d.photos.filter((p) => !set.has(p.id))
  })
}
