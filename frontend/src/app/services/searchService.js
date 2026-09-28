// Face search (C# backend -> Python engine). One event at a time.
import { api, ApiError } from './api'
import { toMatch, toSearch } from './adapters'
import { emitChange } from './bus'

export class FaceError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

// The response to the search itself is the only one that carries the matched
// face box, so the latest result per event is kept for this browser session.
const cacheKey = (eventId) => `gh.search.${eventId}`

function cacheSearch(s) {
  try {
    sessionStorage.setItem(cacheKey(s.eventId), JSON.stringify(s))
  } catch {
    // ignore
  }
}

function cachedSearch(eventId) {
  try {
    return JSON.parse(sessionStorage.getItem(cacheKey(eventId)) || 'null')
  } catch {
    return null
  }
}

/** blobs: 1-5 selfie frames of the same person. */
export async function search(eventId, blobs) {
  const form = new FormData()
  blobs.forEach((b, i) => form.append('selfies', b, `selfie-${i}.jpg`))
  try {
    const s = toSearch(await api(`/api/search/${eventId}`, { method: 'POST', form }))
    cacheSearch(s)
    emitChange()
    return s
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 422) {
        const reason = e.data?.reason
        throw new FaceError(reason === 'FaceTooSmall' ? 'too_small' : reason === 'Unreadable' ? 'unreadable' : 'no_face', e.message)
      }
      if (e.status === 404) throw new FaceError('not_found', 'This event isn’t available for search.')
      if (e.status === 503) throw new FaceError('offline', e.message)
    }
    throw new FaceError('failed', e.message || 'Search failed. Please try again.')
  }
}

/** Latest results for an event: this session's search (with face boxes) or the saved one. */
export async function lastSearch(eventId) {
  const cached = cachedSearch(eventId)
  if (cached) return cached
  try {
    const s = toSearch(await api(`/api/search/my/latest/${eventId}`))
    cacheSearch(s)
    return s
  } catch (e) {
    if (e.status === 404) return null
    throw e
  }
}

export async function mySearches() {
  return api('/api/search/my')
}

export async function myPhotos() {
  return (await api('/api/search/my/photos')).map(toMatch)
}

export async function clearHistory() {
  await api('/api/search/my', { method: 'DELETE' })
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith('gh.search.'))
      .forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // ignore
  }
  emitChange()
}

export function matchLabel(score) {
  if (score >= 0.6) return { text: 'Strong match', tone: 'strong' }
  if (score >= 0.45) return { text: 'Good match', tone: 'good' }
  return { text: 'Possible match', tone: 'maybe' }
}

export function shareLink(event) {
  return `${window.location.origin}/events/${event.id ?? event.eventId}`
}

// ── favorites & consent ──────────────────────────────────────────────────
// The database has no favorites/consent tables yet, so these are kept per
// user in this browser.
const favKey = (userId) => `gh.favorites.${userId}`

export function favorites(userId) {
  try {
    return JSON.parse(localStorage.getItem(favKey(userId)) || '[]')
  } catch {
    return []
  }
}

function saveFavorites(userId, list) {
  try {
    localStorage.setItem(favKey(userId), JSON.stringify(list))
  } catch {
    // ignore
  }
  emitChange()
}

export function toggleFavorite(userId, photoId) {
  const list = favorites(userId)
  const on = !list.includes(photoId)
  saveFavorites(userId, on ? [photoId, ...list] : list.filter((x) => x !== photoId))
  return on
}

export function setFavorites(userId, photoIds, on) {
  const set = new Set(favorites(userId))
  photoIds.forEach((id) => (on ? set.add(id) : set.delete(id)))
  saveFavorites(userId, [...set])
}

const CONSENT_KEY = 'gh.consent'

export function hasConsent(userId, eventId) {
  try {
    return (JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')[userId] || []).includes(String(eventId))
  } catch {
    return false
  }
}

export function giveConsent(userId, eventId) {
  try {
    const all = JSON.parse(localStorage.getItem(CONSENT_KEY) || '{}')
    all[userId] = [...new Set([...(all[userId] || []), String(eventId)])]
    localStorage.setItem(CONSENT_KEY, JSON.stringify(all))
  } catch {
    // ignore
  }
}
