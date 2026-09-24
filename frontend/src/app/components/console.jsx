// Building blocks shared by the Super Admin and Event Admin consoles.
import { Archive, CalendarDays, CalendarPlus, Ellipsis, Eye, Images, MapPin, Pencil, ScanSearch, Search, UserPlus } from 'lucide-react'
import { motion } from 'motion/react'
import { Link } from 'react-router'
import { compact, fmtDate, timeAgo } from '../lib/utils'
import Photo from './Photo'
import { Menu } from './ui/overlay'
import { AvatarStack, Skeleton, StatusBadge } from './ui/primitives'

export function EventCover({ ev, className }) {
  return ev.cover ? (
    <Photo photo={{ src: ev.cover, color: '#0f2452' }} className={className} />
  ) : (
    <div className={`grid place-items-center bg-gradient-to-br from-navy-800 via-navy-900 to-brand-900 text-white/60 ${className}`}>
      <CalendarPlus className="size-8" strokeWidth={1.4} />
    </div>
  )
}

export function AdminEventCard({ ev, to, onAssign, onArchive, onEdit, i = 0, showAdmins = true }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 8) * 0.04, duration: 0.4 }}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card transition-shadow hover:shadow-lift"
    >
      <Link to={to} className="relative block aspect-[16/9] overflow-hidden" aria-label={`Open ${ev.name}`}>
        <EventCover ev={ev} className="size-full transition-transform duration-700 group-hover:scale-[1.03]" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950/55 to-transparent" />
        <StatusBadge status={ev.status} onDark className="absolute top-3 left-3" />
        <span className="absolute bottom-3 left-3 text-[12px] font-medium text-white/85">{ev.type}</span>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          <Link to={to} className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-navy-950 hover:text-brand-700">{ev.name}</h3>
          </Link>
          {(onEdit || onAssign || onArchive) && (
            <Menu
              trigger={({ toggle, open }) => (
                <button onClick={toggle} aria-expanded={open} aria-label={`Actions for ${ev.name}`} className="-mt-1 -mr-1 grid size-8 place-items-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-800">
                  <Ellipsis className="size-4" />
                </button>
              )}
              items={[
                { label: 'View', icon: Eye, onClick: () => onEdit?.('view') },
                onEdit && { label: 'Edit details', icon: Pencil, onClick: () => onEdit('edit') },
                onAssign && { label: 'Assign admin', icon: UserPlus, onClick: onAssign },
                onArchive && ev.status !== 'Archived' && '-',
                onArchive && ev.status !== 'Archived' && { label: 'Archive', icon: Archive, danger: true, onClick: onArchive },
              ]}
            />
          )}
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-navy-500">
          <span className="flex items-center gap-1">
            <CalendarDays className="size-3.5" /> {fmtDate(ev.date)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="size-3.5" /> {ev.city}
          </span>
        </p>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-navy-100 pt-3">
          <span className="flex gap-4 text-[13px] text-navy-600">
            <span className="flex items-center gap-1.5" title="Photos">
              <Images className="size-3.5 text-navy-400" /> <span className="font-medium tabular-nums">{compact(ev.stats.photos)}</span>
            </span>
            <span className="flex items-center gap-1.5" title="Searches">
              <ScanSearch className="size-3.5 text-navy-400" /> <span className="font-medium tabular-nums">{compact(ev.stats.searches)}</span>
            </span>
          </span>
          {showAdmins && <AvatarStack users={ev.admins} size={26} />}
        </div>
      </div>
    </motion.article>
  )
}

export function CardGridSkeleton({ n = 6 }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-navy-100 bg-white">
          <Skeleton className="aspect-[16/9] rounded-none" />
          <div className="grid gap-2.5 p-4">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-2 h-7 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

const ACT_ICON = { search: Search, upload: Images, event: CalendarPlus, assign: UserPlus, download: Images, user: UserPlus }

export function ActivityFeed({ items }) {
  if (!items?.length) return <p className="py-6 text-center text-sm text-navy-400">No activity yet. It’ll show up here as guests search and admins upload.</p>
  return (
    <ul className="grid gap-4">
      {items.map((a) => {
        const Icon = ACT_ICON[a.kind] || Search
        return (
          <li key={a.id} className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-50 text-navy-600 ring-1 ring-navy-100">
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 text-sm">
              <p className="text-navy-800">{a.text}</p>
              <p className="text-[12px] text-navy-400">
                {a.event && <span>{a.event} · </span>}
                {timeAgo(a.at)}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function StatStrip({ items }) {
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-navy-100 bg-white shadow-card sm:grid-cols-3 lg:grid-cols-5">
      {items.map(({ label, value, icon: Icon }) => (
        <div key={label} className="border-navy-100 p-4 not-last:border-b sm:p-5 lg:border-r lg:border-b-0 lg:last:border-r-0">
          <dt className="flex items-center gap-1.5 text-[13px] text-navy-500">
            {Icon && <Icon className="size-3.5" />} {label}
          </dt>
          <dd className="mt-1.5 text-2xl font-semibold text-navy-950 tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
