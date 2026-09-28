// Tiny change-notification bus: services call emitChange() after a write so
// open screens (useQuery live mode) refresh themselves.
const listeners = new Set()

export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function emitChange() {
  listeners.forEach((fn) => fn())
}
