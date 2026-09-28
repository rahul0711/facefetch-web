import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  Images,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  ScanFace,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import Logo from '../components/ui/Logo'
import { Drawer } from '../components/ui/overlay'
import { Avatar } from '../components/ui/primitives'
import { useQuery } from '../lib/hooks'
import { cn } from '../lib/utils'
import { ROLE_LABEL } from '../services/authService'
import { listAdminEvents } from '../services/eventService'

const NAV = {
  super_admin: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/events', label: 'Events', icon: CalendarDays },
    { to: '/admin/admins', label: 'Event Admins', icon: UserCog },
    { to: '/admin/visitors', label: 'Visitors', icon: ScanFace },
    { to: '/admin/users', label: 'Accounts', icon: Users },
    { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  event_admin: [
    { to: '/event-admin', label: 'Overview', icon: LayoutDashboard, end: true },
    // event sub-pages light up the section they belong to, not "My Events"
    { to: '/event-admin/events', label: 'My Events', icon: CalendarRange, active: (p) => p.startsWith('/event-admin/events') && !p.endsWith('/photos') && !p.endsWith('/analytics') },
    { to: '/event-admin/photos', label: 'Photos', icon: Images, active: (p) => p.endsWith('/photos') },
    { to: '/event-admin/analytics', label: 'Analytics', icon: BarChart3, active: (p) => p.endsWith('/analytics') },
    { to: '/event-admin/settings', label: 'Settings', icon: Settings },
  ],
}

function Sidebar({ role, onNavigate }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { data } = useQuery(() => (role === 'event_admin' ? listAdminEvents() : Promise.resolve([])), [role])
  const assigned = data || []

  return (
    <div className="flex h-full flex-col bg-navy-950 text-navy-200">
      <div className="flex h-16 items-center px-5">
        <Logo dark />
      </div>
      <div className="px-5 pb-4">
        <span className="inline-flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 text-[11px] font-medium tracking-wide text-navy-300 uppercase ring-1 ring-white/10">
          <ShieldCheck className="size-3.5 text-cyan-300" /> {ROLE_LABEL[role]}
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3" aria-label="Console">
        <ul className="grid gap-0.5">
          {NAV[role].map(({ to, label, icon: Icon, end, active: activeFor }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) => {
                  const active = activeFor ? activeFor(pathname) : isActive
                  return cn(
                    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    active ? 'bg-white/[0.08] text-white' : 'text-navy-300 hover:bg-white/[0.04] hover:text-white',
                  )
                }}
              >
                {({ isActive }) => (
                  <>
                    {(activeFor ? activeFor(pathname) : isActive) && <span className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r-full bg-cyan-300" />}
                    <Icon className="size-[18px]" strokeWidth={1.8} />
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {role === 'event_admin' && (
          <div className="mt-8">
            <p className="px-3 text-[11px] font-medium tracking-wider text-navy-500 uppercase">Your events</p>
            <ul className="mt-2 grid gap-0.5">
              {assigned.map((ev) => (
                <li key={ev.id}>
                  <NavLink
                    to={`/event-admin/events/${ev.id}`}
                    onClick={onNavigate}
                    className={() =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                        pathname.startsWith(`/event-admin/events/${ev.id}`) ? 'bg-white/[0.06] text-white' : 'text-navy-300 hover:text-white',
                      )
                    }
                  >
                    <span className={cn('size-1.5 shrink-0 rounded-full', ev.status === 'Active' ? 'bg-cyan-300' : ev.status === 'Draft' ? 'bg-brand-400' : 'bg-navy-500')} />
                    <span className="truncate">{ev.name}</span>
                  </NavLink>
                </li>
              ))}
              {data && !assigned.length && <li className="px-3 py-2 text-[13px] text-navy-500">No events assigned yet.</li>}
            </ul>
            <p className="mt-3 px-3 text-[12px] leading-relaxed text-navy-500">Events you created or a Super Admin assigned to you.</p>
          </div>
        )}
      </nav>
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-lg p-2">
          <Avatar user={user} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-[12px] text-navy-400">{user.email}</p>
          </div>
          <button
            onClick={() => {
              logout()
              navigate('/')
            }}
            className="grid size-8 place-items-center rounded-lg text-navy-400 hover:bg-white/5 hover:text-white"
            aria-label="Log out"
            title="Log out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ConsoleLayout({ role }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  return (
    <div className="min-h-dvh bg-[#f3f5f9]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        <Sidebar role={role} />
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-navy-100 bg-white/85 px-4 backdrop-blur-xl lg:hidden">
        <button onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-lg text-navy-800 hover:bg-navy-100" aria-label="Open navigation">
          <MenuIcon className="size-5" />
        </button>
        <Logo size={28} />
      </header>
      <Drawer open={open} onClose={() => setOpen(false)} side="left" className="max-w-[288px]">
        <Sidebar role={role} onNavigate={() => setOpen(false)} />
      </Drawer>
      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
