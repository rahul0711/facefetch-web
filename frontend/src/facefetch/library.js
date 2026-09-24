// The user's photo library, stored in *their browser* (IndexedDB) -- the
// server keeps nothing. Each photo is sent to /api/analyze once; the faces
// and embeddings that come back are stored next to it, so searching is a
// local dot product over every stored face.

const DB_NAME = 'facefetch'
const DB_VERSION = 1
// 'photos' holds metadata + faces + thumbnail (small, loaded on startup);
// 'originals' holds the full files, read only for viewing/downloading.
const PHOTOS = 'photos'
const ORIGINALS = 'originals'

let dbPromise = null

function openDb() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(ORIGINALS)) db.createObjectStore(ORIGINALS, { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx(stores, mode, fn) {
  const db = await openDb()
  const t = db.transaction(stores, mode)
  fn(t)
  await new Promise((resolve, reject) => {
    t.oncomplete = resolve
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error || new Error('Storage transaction aborted'))
  })
}

export async function loadAllPhotos() {
  const db = await openDb()
  const rows = await reqToPromise(db.transaction(PHOTOS).objectStore(PHOTOS).getAll())
  return rows.sort((a, b) => a.addedAt - b.addedAt)
}

export async function putPhoto(record) {
  await tx([PHOTOS], 'readwrite', (t) => t.objectStore(PHOTOS).put(record))
}

export async function addPhotoWithOriginal(record, blob) {
  await tx([PHOTOS, ORIGINALS], 'readwrite', (t) => {
    t.objectStore(PHOTOS).put(record)
    t.objectStore(ORIGINALS).put({ id: record.id, blob })
  })
}

export async function getOriginal(id) {
  const db = await openDb()
  const row = await reqToPromise(db.transaction(ORIGINALS).objectStore(ORIGINALS).get(id))
  return row?.blob ?? null
}

export async function deletePhotos(ids) {
  await tx([PHOTOS, ORIGINALS], 'readwrite', (t) => {
    for (const id of ids) {
      t.objectStore(PHOTOS).delete(id)
      t.objectStore(ORIGINALS).delete(id)
    }
  })
}

export async function clearLibrary() {
  await tx([PHOTOS, ORIGINALS], 'readwrite', (t) => {
    t.objectStore(PHOTOS).clear()
    t.objectStore(ORIGINALS).clear()
  })
}

// ------------------------------------------------------------------ images

export const isImageFile = (f) =>
  f.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif|heic|heif|avif)$/i.test(f.name)

const canvasToJpeg = (canvas, quality) =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

function drawScaled(bmp, maxSide) {
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bmp.width * scale))
  canvas.height = Math.max(1, Math.round(bmp.height * scale))
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  return canvas
}

// One decode -> an analysis copy (EXIF rotation applied, capped size, so
// the server's face boxes line up with what the browser displays) and a
// small thumbnail for the grid.
export async function prepareImage(blob, { analyzeSide = 2000, thumbSide = 480 } = {}) {
  const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' })
  try {
    const analyze = await canvasToJpeg(drawScaled(bmp, analyzeSide), 0.92)
    const thumb = await canvasToJpeg(drawScaled(bmp, thumbSide), 0.8)
    if (!analyze || !thumb) throw new Error('encode failed')
    return { analyze, thumb, width: bmp.width, height: bmp.height }
  } finally {
    bmp.close?.()
  }
}

// ---------------------------------------------------------------- matching

export function decodeEmbedding(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Float32Array(bytes.buffer)
}

function dot(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

// Every analyzed photo with a face scoring above threshold against the
// query (both sides L2-normalized, so dot product == cosine similarity).
export function findMatches(photos, query, threshold) {
  const out = []
  for (const p of photos) {
    if (p.status !== 'done' || !p.faces.length) continue
    let best = -1
    let bestIdx = -1
    p.faces.forEach((f, i) => {
      const s = dot(query, f.emb)
      if (s > best) {
        best = s
        bestIdx = i
      }
    })
    if (best >= threshold) {
      out.push({ photo: p, score: best, box: p.faces[bestIdx].box })
    }
  }
  return out.sort((a, b) => b.score - a.score)
}

// ---------------------------------------------------------------------- zip

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Minimal store-only (no compression -- photos don't compress) zip writer.
export async function buildZip(files) {
  const enc = new TextEncoder()
  const parts = []
  const central = []
  const used = new Set()
  let offset = 0
  const now = new Date()
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

  for (const { name, blob } of files) {
    let unique = name
    for (let n = 1; used.has(unique); n++) unique = name.replace(/(\.[^.]*)?$/, `_${n}$1`)
    used.add(unique)

    const data = new Uint8Array(await blob.arrayBuffer())
    const nameBytes = enc.encode(unique)
    const crc = crc32(data)

    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint16(6, 0x0800, true) // UTF-8 names
    local.setUint16(8, 0, true) // stored
    local.setUint16(10, dosTime, true)
    local.setUint16(12, dosDate, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, data.length, true)
    local.setUint32(22, data.length, true)
    local.setUint16(26, nameBytes.length, true)
    parts.push(local, nameBytes, data)

    const cen = new DataView(new ArrayBuffer(46))
    cen.setUint32(0, 0x02014b50, true)
    cen.setUint16(4, 20, true)
    cen.setUint16(6, 20, true)
    cen.setUint16(8, 0x0800, true)
    cen.setUint16(10, 0, true)
    cen.setUint16(12, dosTime, true)
    cen.setUint16(14, dosDate, true)
    cen.setUint32(16, crc, true)
    cen.setUint32(20, data.length, true)
    cen.setUint32(24, data.length, true)
    cen.setUint16(28, nameBytes.length, true)
    cen.setUint32(42, offset, true)
    central.push(cen, nameBytes)
    offset += 30 + nameBytes.length + data.length
  }

  const cenSize = central.reduce((s, p) => s + p.byteLength, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, files.length, true)
  end.setUint16(10, files.length, true)
  end.setUint32(12, cenSize, true)
  end.setUint32(16, offset, true)
  return new Blob([...parts, ...central, end], { type: 'application/zip' })
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
