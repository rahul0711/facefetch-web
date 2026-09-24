import { CalendarDays, Lock, MapPin, ShieldAlert, ShieldCheck } from 'lucide-react'
import { NavLink, useParams } from 'react-router'
import { useAuth } from '../../auth/AuthContext'
import { EventCover } from '../../components/console'
import Button from '../../components/ui/Button'
import { Badge, EmptyState, Skeleton, StatusBadge } from '../../components/ui/primitives'
import { PERMISSIONS } from '../../data/seed'
import { useQuery } from '../../lib/hooks'
import { cn, fmtDate } from '../../lib/utils'
import { adminPerms, getEvent } from '../../services/eventService'

// Loads an event for the signed-in event admin, enforcing assignment.
export function useAdminEvent() {
  const { eventId } = useParams()
  const { user } = useAuth()
  const perms = adminPerms(user.id, eventId)
  const q = useQuery(() => (perms ? getEvent(eventId) : Promise.reject(new Error('not-assigned'))), [eventId, !!perms])
  return { ...q, ev: q.data, perms, eventId }
}

export function NotAssigned() {
  return (
    <EmptyState icon={ShieldAlert} title="This event isn’t assigned to you" action={<Button to="/event-admin/events">Your events</Button>} className="rounded-2xl border border-navy-100 bg-white">
      Event admins can only open events a Super Admin has assigned to them. Ask your Super Admin for access.
    </EmptyState>
  )
}

export function Locked({ what }) {
  return (
    <EmptyState icon={Lock} title={`You can’t ${what} for this event`} className="rounded-2xl border border-dashed border-navy-200 bg-white">
      Your access doesn’t include this permission. A Super Admin can change it from the event’s admin settings.
    </EmptyState>
  )
}

export function EventHeaderSkeleton() {
  return (
    <div className="grid gap-4">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-10 w-80" />
    </div>
  )
}

const TABS = [
  { to: '', label: 'Overview', perm: 'view' },
  { to: '/photos', label: 'Photos', perm: 'view' },
  { to: '/analytics', label: 'Analytics', perm: 'analytics' },
  { to: '/settings', label: 'Settings', perm: 'view' },
]

export function EventAdminHeader({ ev, perms, actions }) {
  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <EventCover ev={ev} className="size-16 shrink-0 rounded-2xl sm:size-[72px]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold text-navy-950 sm:text-[28px]">{ev.name}</h1>
            <StatusBadge status={ev.status} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy-500">
            <span>{ev.subtitle}</span>
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" /> {fmtDate(ev.date, { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" /> {ev.city}
            </span>
          </p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100">
        <nav className="scrollbar-none -mb-px flex gap-1 overflow-x-auto" aria-label="Event sections">
          {TABS.map((t) => (
            <NavLink
              key={t.label}
              end
              to={`/event-admin/events/${ev.id}${t.to}`}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
                  isActive ? 'border-brand-600 text-navy-950' : 'border-transparent text-navy-500 hover:text-navy-900',
                )
              }
            >
              {t.label}
              {!perms[t.perm] && <Lock className="size-3 text-navy-400" />}
            </NavLink>
          ))}
        </nav>
        <PermissionChips perms={perms} />
      </div>
    </div>
  )
}

export function PermissionChips({ perms, className }) {
  const n = PERMISSIONS.filter((p) => perms[p.key]).length
  return (
    <span className={cn('flex items-center gap-2 pb-2 text-[12px] text-navy-500', className)} title={PERMISSIONS.map((p) => `${perms[p.key] ? '✓' : '✗'} ${p.label}`).join('\n')}>
      <ShieldCheck className="size-3.5 text-brand-600" />
      Your access:
      <Badge tone={n === 5 ? 'brand' : 'neutral'}>{n === 5 ? 'Full access' : PERMISSIONS.filter((p) => perms[p.key]).map((p) => p.short).join(' · ')}</Badge>
    </span>
  )
}
