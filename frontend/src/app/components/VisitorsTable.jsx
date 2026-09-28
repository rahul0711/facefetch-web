import { Download, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useQuery } from '../lib/hooks'
import { fmtDate, num, timeAgo } from '../lib/utils'
import { listVisitors } from '../services/searchService'
import Button from './ui/Button'
import { Avatar, EmptyState, Input, Skeleton } from './ui/primitives'

function toCsv(rows, withEvents) {
  const cell = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`
  const head = ['Name', 'Email', ...(withEvents ? ['Events'] : []), 'Searches', 'Photos found', 'First search', 'Last search']
  const body = rows.map((v) => [v.name, v.email, ...(withEvents ? [v.events] : []), v.searches, v.photosFound, v.firstSeen, v.lastSeen].map(cell).join(','))
  return [head.map(cell).join(','), ...body].join('\n')
}

/**
 * Everyone who searched (by the name + email they typed before their selfie).
 * eventId: only that event; omit for every event (Super Admin).
 */
export default function VisitorsTable({ eventId, limit }) {
  const { data, loading, error } = useQuery(() => listVisitors(eventId), [eventId])
  const [q, setQ] = useState('')
  const all = eventId == null
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = (data || []).filter((v) => !t || `${v.name} ${v.email}`.toLowerCase().includes(t))
    return limit ? list.slice(0, limit) : list
  }, [data, q, limit])

  const exportCsv = () => {
    const blob = new Blob([toCsv(data || [], all)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `visitors-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full sm:w-72">
          <Input icon={Search} placeholder="Search by name or email" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search visitors" className="h-10" />
        </div>
        <p className="text-[13px] text-navy-500">{data ? `${num(data.length)} ${data.length === 1 ? 'person' : 'people'}` : ''}</p>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={exportCsv} disabled={!data?.length}>
          <Download /> Export CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-navy-100 bg-white">
        {loading && !data ? (
          <div className="grid gap-3 p-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={Users} title="Couldn’t load visitors" className="py-10">
            {error.message}
          </EmptyState>
        ) : !shown.length ? (
          <EmptyState icon={Users} title={q ? 'No one matches' : 'No visitors yet'} className="py-10">
            {q ? 'Try a different name or email.' : 'When guests search with a selfie, their name and email appear here.'}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-navy-100 bg-navy-50/60 text-[12px] tracking-wide text-navy-500 uppercase">
                <tr>
                  <th className="px-4 py-3 font-medium sm:px-5">Visitor</th>
                  {all && <th className="hidden px-4 py-3 font-medium lg:table-cell">Events</th>}
                  <th className="px-4 py-3 text-right font-medium">Searches</th>
                  <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Photos found</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">First search</th>
                  <th className="px-4 py-3 font-medium">Last search</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100">
                {shown.map((v) => (
                  <tr key={v.email} className="hover:bg-navy-50/40">
                    <td className="px-4 py-3 sm:px-5">
                      <div className="flex items-center gap-3">
                        <Avatar user={{ name: v.name }} size={34} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-navy-900">{v.name}</p>
                          <a href={`mailto:${v.email}`} className="truncate text-[13px] text-navy-500 hover:text-brand-700">
                            {v.email}
                          </a>
                        </div>
                      </div>
                    </td>
                    {all && <td className="hidden max-w-64 truncate px-4 py-3 text-navy-600 lg:table-cell">{v.events}</td>}
                    <td className="px-4 py-3 text-right text-navy-900 tabular-nums">{num(v.searches)}</td>
                    <td className="hidden px-4 py-3 text-right text-navy-900 tabular-nums sm:table-cell">{num(v.photosFound)}</td>
                    <td className="hidden px-4 py-3 text-navy-500 md:table-cell">{fmtDate(v.firstSeen)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-navy-500">{timeAgo(v.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
