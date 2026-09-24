// Face search, scoped to ONE event. In the demo:
//  * verifyFace() really checks the selfie with the Genesis Hub engine
//    (POST /api/query -> SCRFD + AdaFace) whenever the backend is running,
//    so "no face" / "face too small" errors are genuine. If the backend
//    isn't reachable it falls back to a mock check.
//  * search() returns a deterministic mock set of that event's photos.
//    With a real backend this becomes POST /events/:id/search {embedding}.
import { rng } from '../data/seed'
import { commit, db, delay } from './db'

export class FaceError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const FRIENDLY = {
  no_face: 'We couldn’t see a face. Face the camera in good light and try again.',
  too_small: 'Your face is a little far away. Move closer so it fills the oval.',
  unreadable: 'That file isn’t a photo we can read. Try a JPG or PNG.',
}

export async function verifyFace(blobs) {
  const fd = new FormData()
  blobs.forEach((b, i) => fd.append('images', b, `selfie-${i}.jpg`))
  let res
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 12000)
    res = await fetch('/api/query', { method: 'POST', body: fd, signal: ctrl.signal })
    clearTimeout(t)
  } catch {
    await delay(700)
    return { engine: 'mock' }
  }
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}))
    const detail = String(body.detail || '').toLowerCase()
    if (detail.includes('too small') || detail.includes('closer')) throw new FaceError('too_small', FRIENDLY.too_small)
    if (detail.includes("isn't an image")) throw new FaceError('unreadable', FRIENDLY.unreadable)
    throw new FaceError('no_face', FRIENDLY.no_face)
  }
  if (!res.ok) {
    // Backend missing or out of date -- keep the demo flowing.
    await delay(500)
    return { engine: 'mock' }
  }
  return { engine: 'facefetch' }
}

function faceArea(b) {
  return (b[2] - b[0]) * (b[3] - b[1])
}

// Mock matching: a stable ~55% of the event's analyzed photos "contain you".
export async function search(eventId, userId) {
  await delay(400)
  const d = db()
  const r = rng(`${eventId}:${userId}`)
  const photos = d.photos.filter((p) => p.eventId === eventId && p.status === 'processed' && p.faces.length)
  const hits = []
  for (const p of photos) {
    // "You" are one of the clearly visible people -- never a speck in the crowd.
    const w = (b) => b[2] - b[0]
    const largest = Math.max(...p.faces.map(w))
    if (r() > 0.62 || largest < 0.035) continue
    const candidates = p.faces.filter((b) => w(b) >= largest * 0.55).sort((a, b) => faceArea(b) - faceArea(a))
    const face = candidates[Math.floor(r() * candidates.length)]
    // Bigger, clearer faces match more confidently -- as they would for real.
    const clarity = Math.min(1, w(face) / 0.18)
    hits.push({ photoId: p.id, score: +Math.min(0.99, 0.64 + clarity * 0.26 + r() * 0.09).toFixed(3), box: face })
  }
  hits.sort((a, b) => b.score - a.score)
  const result = { eventId, at: new Date().toISOString(), hits }
  commit((db2) => {
    ;(db2.searches[userId] ||= {})[eventId] = result
    const ev = db2.events.find((e) => e.id === eventId)
    ev.stats.searches += 1
    db2.activity.unshift({
      id: `act-${Date.now()}`,
      kind: 'search',
      text: `${db2.users.find((u) => u.id === userId)?.name || 'A guest'} found ${hits.length} photos`,
      event: ev.name,
      at: result.at,
    })
  })
  return result
}

export function lastSearch(eventId, userId) {
  return db().searches[userId]?.[eventId] || null
}

// Every photo the user has been found in, across events.
export function myMatches(userId) {
  const d = db()
  const out = []
  for (const s of Object.values(d.searches[userId] || {})) {
    for (const h of s.hits) {
      const p = d.photos.find((x) => x.id === h.photoId)
      if (p) out.push({ ...h, photo: p })
    }
  }
  return out
}

export function matchLabel(score) {
  if (score >= 0.85) return { text: 'Strong match', tone: 'strong' }
  if (score >= 0.72) return { text: 'Good match', tone: 'good' }
  return { text: 'Possible match', tone: 'maybe' }
}

// ---------------------------------------------------------------- favorites

export function favorites(userId) {
  return db().favorites[userId] || []
}

export function toggleFavorite(userId, photoId) {
  let on = false
  commit((d) => {
    const list = (d.favorites[userId] ||= [])
    const i = list.indexOf(photoId)
    if (i >= 0) list.splice(i, 1)
    else {
      list.unshift(photoId)
      on = true
    }
  })
  return on
}

export function setFavorites(userId, photoIds, on) {
  commit((d) => {
    const set = new Set(d.favorites[userId] || [])
    photoIds.forEach((id) => (on ? set.add(id) : set.delete(id)))
    d.favorites[userId] = [...set]
  })
}

export function recordDownload(userId, count = 1) {
  commit((d) => {
    d.downloads[userId] = (d.downloads[userId] || 0) + count
  })
}

export function shareLink(event, photo) {
  const short = photo ? photo.id.split('__').pop().slice(0, 8) : ''
  return `https://genesishub.demo/e/${event.slug}${photo ? `/p/${short}` : ''}`
}

// ------------------------------------------------------------------ consent
// Biometric consent is asked once per guest per event.
const CONSENT_KEY = 'genesishub.demo.consent'

export function hasConsent(userId, eventId) {
  try {
    return (JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')[userId] || []).includes(eventId)
  } catch {
    return false
  }
}

export function giveConsent(userId, eventId) {
  try {
    const all = JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')
    all[userId] = [...new Set([...(all[userId] || []), eventId])]
    localStorage.setItem(CONSENT_KEY, JSON.stringify(all))
  } catch {
    // storage unavailable: consent holds for this session only
  }
}

export function clearHistory(userId) {
  commit((d) => {
    delete d.searches[userId]
  })
}
