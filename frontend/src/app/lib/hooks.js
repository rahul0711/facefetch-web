import { useCallback, useEffect, useRef, useState } from 'react'
import { subscribe } from '../services/db'

// Load data from a (mock) service. Re-runs when deps change, and silently
// refreshes when the mock DB changes so every screen stays in sync.
export function useQuery(fn, deps = [], { live = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: true })
  const fnRef = useRef(fn)
  fnRef.current = fn

  const run = useCallback(async (silent) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const data = await fnRef.current()
      setState({ data, error: null, loading: false })
    } catch (error) {
      setState({ data: undefined, error, loading: false })
    }
  }, [])

  useEffect(() => {
    run(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => (live ? subscribe(() => run(true)) : undefined), [live, run])

  return { ...state, reload: () => run(false) }
}

// Re-render whenever the mock DB changes (for synchronous reads).
export function useDbVersion() {
  const [v, setV] = useState(0)
  useEffect(() => subscribe(() => setV((x) => x + 1)), [])
  return v
}

export function useMediaQuery(q) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setMatch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [q])
  return match
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Genesis Hub` : 'Genesis Hub — Find every moment you’re in'
  }, [title])
}
