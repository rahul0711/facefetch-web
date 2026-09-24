// Analytics. Mock series are seeded so charts look the same on every load;
// headline numbers are derived from the event stats in db.js.
import { dailySeries, TODAY } from '../data/seed'
import { db, delay } from './db'

const sum = (xs, k) => xs.reduce((n, x) => n + (k ? x[k] : x), 0)

function statusBreakdown(photos) {
  const counts = { processed: 0, analyzing: 0, uploading: 0, failed: 0 }
  for (const p of photos) counts[p.status] = (counts[p.status] || 0) + 1
  return counts
}

// GET /analytics/platform
export async function platformOverview() {
  await delay(500)
  const d = db()
  const events = d.events
  const stats = events.map((e) => e.stats)
  const searches = dailySeries('searches', 30, 2.2)
  const uploads = dailySeries('uploads', 30, 9)
  const storageGb = Math.round(sum(stats, 'photos') * 6.1) / 1000 // ~6 MB/photo
  return {
    totals: {
      events: events.length,
      active: events.filter((e) => e.status === 'Live' || e.status === 'Upcoming').length,
      live: events.filter((e) => e.status === 'Live').length,
      admins: d.users.filter((u) => u.role === 'event_admin').length,
      users: d.users.filter((u) => u.role === 'end_user').length,
      photos: sum(stats, 'photos'),
      faces: sum(stats, 'faces'),
      searches: sum(stats, 'searches'),
      discovered: Math.round(sum(stats, 'downloads') * 3.4),
      downloads: sum(stats, 'downloads'),
      visitors: sum(stats, 'visitors'),
      searchesToday: searches.at(-1).value,
      searchesYesterday: searches.at(-2).value,
      successRate: 0.91,
    },
    searches,
    uploads,
    storage: { usedGb: storageGb, quotaGb: 250 },
    topEvents: [...events]
      .filter((e) => e.stats.searches > 0)
      .sort((a, b) => b.stats.searches - a.stats.searches)
      .slice(0, 6)
      .map((e) => ({ id: e.id, name: e.name, value: e.stats.searches })),
    processing: statusBreakdown(d.photos),
    recentEvents: [...events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
    activity: d.activity.slice(0, 8),
  }
}

// GET /analytics/events/:id
export async function eventAnalytics(eventId) {
  await delay(450)
  const d = db()
  const ev = d.events.find((e) => e.id === eventId)
  const photos = d.photos.filter((p) => p.eventId === eventId)
  const days = Math.max(7, Math.min(21, Math.round((TODAY - new Date(ev.date)) / 86400000) + 3))
  const scale = Math.max(0.05, ev.stats.searches / 1200)
  return {
    event: ev,
    totals: {
      photos: ev.stats.photos,
      faces: ev.stats.faces,
      searches: ev.stats.searches,
      successful: Math.round(ev.stats.searches * 0.91),
      downloads: ev.stats.downloads,
      visitors: ev.stats.visitors,
    },
    searches: ev.stats.searches ? dailySeries(`s-${eventId}`, days, scale) : [],
    uploads: ev.stats.photos ? dailySeries(`u-${eventId}`, days, Math.max(0.2, ev.stats.photos / 400)) : [],
    processing: statusBreakdown(photos),
  }
}

// GET /analytics/admins/:id  (only the admin's assigned events)
export async function adminOverview(userId) {
  await delay(450)
  const d = db()
  const ids = new Set(d.assignments.filter((a) => a.userId === userId).map((a) => a.eventId))
  const events = d.events.filter((e) => ids.has(e.id))
  const stats = events.map((e) => e.stats)
  return {
    totals: {
      events: events.length,
      photos: sum(stats, 'photos'),
      faces: sum(stats, 'faces'),
      searches: sum(stats, 'searches'),
      visitors: sum(stats, 'visitors'),
      downloads: sum(stats, 'downloads'),
    },
    searches: dailySeries(`admin-${userId}`, 30, Math.max(0.3, sum(stats, 'searches') / 2500)),
    processing: statusBreakdown(d.photos.filter((p) => ids.has(p.eventId))),
    topEvents: events
      .filter((e) => e.stats.searches > 0)
      .sort((a, b) => b.stats.searches - a.stats.searches)
      .map((e) => ({ id: e.id, name: e.name, value: e.stats.searches })),
    activity: d.activity.filter((a) => events.some((e) => e.name === a.event)).slice(0, 6),
  }
}
