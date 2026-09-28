import { CalendarHeart, Heart, Images, LogOut, Settings, UserRound } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import Button from '../components/ui/Button'
import Logo from '../components/ui/Logo'
import { Menu } from '../components/ui/overlay'
import { Avatar } from '../components/ui/primitives'
import { cn } from '../lib/utils'

const NAV = [
  { to: '/events', label: 'Events', icon: CalendarHeart },
  { to: '/my-photos', label: 'My Photos', icon: Images },
  { to: '/favorites', label: 'Favorites', icon: Heart },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

// Visitors without an account only get the events list (no profile, favorites
// or account menu); the event pages themselves work the same for everyone.
export default function UserLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) {
    return (
      <div className="min-h-dvh bg-canvas">
        <header className="sticky top-0 z-40 border-b border-navy-100/80 bg-white/80 backdrop-blur-xl">
          <div className="container-page flex h-16 items-center gap-8">
            <Logo />
            <Button to="/login" variant="ghost" size="sm" className="ml-auto">
              Admin login
            </Button>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    )
  }
  return (
    <div className="min-h-dvh bg-canvas pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-navy-100/80 bg-white/80 backdrop-blur-xl">
        <div className="container-page flex h-16 items-center gap-8">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {NAV.slice(0, 3).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn('rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-navy-100/70 text-navy-950' : 'text-navy-500 hover:text-navy-900')
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <Menu
            className="ml-auto"
            trigger={({ toggle, open }) => (
              <button onClick={toggle} aria-expanded={open} aria-label="Account menu" className="flex items-center gap-2.5 rounded-full py-1 pr-1 pl-3 hover:bg-navy-100/60">
                <span className="text-sm font-medium text-navy-800 max-sm:hidden">{user.name}</span>
                <Avatar user={user} size={34} />
              </button>
            )}
            items={[
              { label: 'Profile', icon: UserRound, onClick: () => navigate('/profile') },
              { label: 'Favorites', icon: Heart, onClick: () => navigate('/favorites') },
              { label: 'Account settings', icon: Settings, onClick: () => navigate('/account') },
              '-',
              {
                label: 'Log out',
                icon: LogOut,
                danger: true,
                onClick: () => {
                  logout()
                  navigate('/')
                },
              },
            ]}
          />
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      {/* mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-navy-100 bg-white/90 pb-safe backdrop-blur-xl md:hidden" aria-label="Main">
        <ul className="grid grid-cols-4 px-2 pt-2">
          {NAV.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn('flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors', isActive ? 'text-brand-700' : 'text-navy-400')
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-brand-50')}>
                      <Icon className="size-5" strokeWidth={isActive ? 2.2 : 1.8} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
