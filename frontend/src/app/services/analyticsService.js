// Dashboards & charts (C# backend analytics endpoints).
import { api } from './api'
import { toEvent } from './adapters'

const series = (points) => (points || []).map((p) => ({ date: p.date, value: p.value }))

function shape(a) {
  const t = a.totals || {}
  return {
    days: a.days,
    totals: {
      events: t.events ?? 0,
      active: t.activeEvents ?? 0,
      photos: t.photos ?? 0,
      faces: t.faces ?? 0,
      searches: t.searches ?? 0,
      successful: t.successfulSearches ?? 0,
      searchesToday: t.searchesToday ?? 0,
      searchesYesterday: t.searchesYesterday ?? 0,
      visitors: t.uniqueVisitors ?? 0,
      downloads: t.downloads ?? 0,
      storageBytes: t.storageBytes ?? 0,
      guests: t.guests ?? 0,
      admins: t.eventAdmins ?? 0,
      successRate: t.searches ? (t.successfulSearches ?? 0) / t.searches : 0,
    },
    searches: series(a.searches),
    uploads: series(a.uploads),
    downloads: series(a.downloads),
    processing: {
      processed: a.photoStatus?.Completed ?? 0,
      analyzing: (a.photoStatus?.Processing ?? 0) + (a.photoStatus?.Pending ?? 0),
      uploading: 0,
      failed: a.photoStatus?.Failed ?? 0,
    },
    topEvents: (a.topEvents || []).map((e) => ({ id: String(e.id), name: e.name, value: e.value })),
  }
}

// Super Admin: platform analytics + recent activity + recent events.
export async function platformOverview(days = 30) {
  const [analytics, dashboard, events] = await Promise.all([
    api(`/api/admin/analytics?days=${days}`),
    api('/api/admin/dashboard'),
    api('/api/events'),
  ])
  return {
    ...shape(analytics),
    activity: (dashboard.recentActivity || []).map((a) => ({
      id: a.logId,
      kind: a.action,
      text: [a.userName, a.description || a.action].filter(Boolean).join(' · '),
      event: a.eventName,
      at: a.createdAt,
    })),
    recentEvents: events.map(toEvent).sort((x, y) => (y.date || '').localeCompare(x.date || '')).slice(0, 5),
  }
}

export async function eventStats(eventId) {
  return api(`/api/events/${eventId}/stats`)
}

export async function eventAnalytics(eventId, days = 30) {
  const [a, stats] = await Promise.all([api(`/api/events/${eventId}/analytics?days=${days}`), eventStats(eventId)])
  return { ...shape(a), stats }
}

// Event Admin: totals + charts across assigned events + per-event stats.
export async function adminOverview(days = 30) {
  const d = await api(`/api/eventadmin/dashboard?days=${days}`)
  return { ...shape(d.analytics), perEvent: Object.fromEntries((d.events || []).map((s) => [String(s.eventId), s])) }
}
