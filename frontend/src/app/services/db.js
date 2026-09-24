// A tiny localStorage-backed "database" standing in for the real backend.
// Services read and write through here; swap the services for real API
// calls later and this file goes away.
import { buildSeed } from '../data/seed'

const KEY = 'genesishub.demo.db'
let state = null
const listeners = new Set()

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.version === buildSeed().version) return parsed
    }
  } catch {
    // unavailable or corrupt storage -- fall back to a fresh seed
  }
  return buildSeed()
}

export function db() {
  if (!state) state = read()
  return state
}

export function commit(mutator) {
  const next = structuredClone(db())
  mutator(next)
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // storage full / private mode: the demo keeps working in memory
  }
  listeners.forEach((fn) => fn())
  return state
}

export function resetDemo() {
  state = buildSeed()
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  listeners.forEach((fn) => fn())
}

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Simulated network latency so loading states are real, not decorative.
export const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms + Math.random() * 150))

export const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
