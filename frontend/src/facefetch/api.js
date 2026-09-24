// Talks to the face engine (app/web/face_search_server.py). The server is
// stateless for these calls: it analyzes what it's sent and keeps nothing.
// In dev, vite.config.js proxies /api/* to it; in production uvicorn serves
// this build itself, so relative paths work in both.

async function readError(res, fallback) {
  const body = await res.json().catch(() => ({}))
  return new Error(body.detail || `${fallback} (${res.status})`)
}

// Every face in one library photo: [{ box, score, embedding(base64 f32) }].
// Retries once on a network blip / server restart.
export async function analyzePhoto(blob, attempt = 0) {
  const fd = new FormData()
  fd.append('image', blob, 'photo.jpg')
  let res
  try {
    res = await fetch('/api/analyze', { method: 'POST', body: fd })
  } catch {
    if (attempt < 1) return analyzePhoto(blob, attempt + 1)
    throw new Error("Can't reach the face engine")
  }
  if (res.status >= 500 && attempt < 1) {
    await new Promise((r) => setTimeout(r, 1500))
    return analyzePhoto(blob, attempt + 1)
  }
  // 404/405: the backend running is an older build without /api/analyze
  // (or something else is answering on that port).
  if (res.status === 404 || res.status === 405) {
    throw new Error('The face engine is out of date or not running. Restart the backend, then press Retry.')
  }
  if (!res.ok) throw await readError(res, 'Analysis failed')
  return res.json()
}

// blobs: 1-5 images of the same person, averaged server-side into one
// query embedding. Returns { embedding (base64 f32), match_threshold }.
export async function queryEmbedding(blobs) {
  const fd = new FormData()
  blobs.forEach((b, i) => fd.append('images', b, `selfie-${i}.jpg`))
  let res
  try {
    res = await fetch('/api/query', { method: 'POST', body: fd })
  } catch {
    throw new Error("Can't reach the face engine. Check that the backend is running.")
  }
  if (!res.ok) throw await readError(res, 'Search failed')
  return res.json()
}

const canvasToJpeg = (canvas, quality = 0.92) =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

// Re-encode an uploaded selfie: applies EXIF rotation and shrinks huge
// camera files. Falls back to the raw file for formats the browser can't
// decode (e.g. HEIC outside Safari).
export async function normalizeImage(file, maxSide = 1600) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close?.()
    return (await canvasToJpeg(canvas)) || file
  } catch {
    return file
  }
}

export function grabVideoFrame(video) {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d').drawImage(video, 0, 0)
  return canvasToJpeg(canvas)
}

export function matchLabel(score) {
  if (score >= 0.6) return { text: 'Strong match', tone: 'strong' }
  if (score >= 0.45) return { text: 'Good match', tone: 'good' }
  return { text: 'Possible match', tone: 'maybe' }
}
