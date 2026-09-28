// HTTP client for the Genesis Hub C# backend (genisis_Hub/, see API.md).
// Every backend response is { success, message, data }; this unwraps `data`
// and turns failures into ApiError with a user-readable message.

const SESSION_KEY = 'gh.session'

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn
}

// ------------------------------------------------------------------ session

export function readSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
    if (!s?.token) return null
    if (s.expiresAt && Date.parse(s.expiresAt) < Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

export function writeSession(s) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // storage blocked: the session lasts for this page only
  }
}

export const getToken = () => readSession()?.token || null

// <img src> can't send headers; the backend accepts ?access_token= on photo URLs.
export function withToken(url) {
  if (!url) return url
  const t = getToken()
  return t ? `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(t)}` : url
}

// --------------------------------------------------------------------- core

const DEFAULT_MESSAGES = {
  400: 'Please check the details and try again.',
  401: 'Your session has ended. Please log in again.',
  403: 'You don’t have permission to do that.',
  404: 'We couldn’t find that.',
  409: 'That already exists.',
  413: 'That file is too large.',
  422: 'We couldn’t process that.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
}

function messageFrom(status, payload) {
  if (payload?.message) return payload.message
  // ASP.NET validation problem details: { title, errors: { Field: ["msg"] } }
  if (payload?.errors) {
    const first = Object.values(payload.errors).flat()[0]
    if (first) return first
  }
  return DEFAULT_MESSAGES[status] || 'Something went wrong. Please try again.'
}

/**
 * api('/api/events')                       GET, returns data
 * api('/api/events', { method: 'POST', json: {...} })
 * api('/api/x', { method: 'POST', form: formData })
 * api('/api/x', { raw: true })             returns the Response (files)
 */
export async function api(path, { method = 'GET', json, form, raw, signal } = {}) {
  const token = getToken()
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  let body
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(json)
  } else if (form) {
    body = form
  }

  let res
  try {
    res = await fetch(path, { method, headers, body, signal })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    throw new ApiError(0, 'Can’t reach the server. Check your connection and try again.')
  }

  if (res.status === 401 && token) onUnauthorized()
  if (raw && res.ok) return res

  let payload = null
  const text = await res.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }
  if (!res.ok || payload?.success === false) throw new ApiError(res.status, messageFrom(res.status, payload), payload?.data)
  return payload && 'data' in payload ? payload.data : payload
}

/** Upload with progress (fetch has no upload progress). Resolves like api(). */
export function apiUpload(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', path)
    const token = getToken()
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed. Check your connection and try again.'))
    xhr.onload = () => {
      let payload = null
      try {
        payload = JSON.parse(xhr.responseText)
      } catch {
        payload = null
      }
      if (xhr.status === 401 && token) onUnauthorized()
      if (xhr.status >= 200 && xhr.status < 300 && payload?.success !== false) resolve(payload?.data ?? payload)
      else reject(new ApiError(xhr.status, messageFrom(xhr.status, payload), payload?.data))
    }
    xhr.send(form)
  })
}

/** Download a file through an authorised request and hand it to the browser. */
export async function downloadFile(path, { method = 'GET', json, filename } = {}) {
  const res = await api(path, { method, json, raw: true })
  const blob = await res.blob()
  const cd = res.headers.get('content-disposition') || ''
  const name = filename || decodeURIComponent(/filename\*=UTF-8''([^;]+)/i.exec(cd)?.[1] || /filename="?([^";]+)"?/i.exec(cd)?.[1] || 'download')
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10000)
}
