import { ArrowRight, Menu as MenuIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import Button from '../components/ui/Button'
import Logo, { GenesisHubLogo } from '../components/ui/Logo'
import { Drawer } from '../components/ui/overlay'
import { cn } from '../lib/utils'
import { ROLE_HOME } from '../services/authService'

const LINKS = [
  // { href: '#features', label: 'Features' },
  { href: '#how', label: 'How It Works' },
  { href: '#organizers', label: 'For Events' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#faq', label: 'FAQ' },
]

export function PublicNav() {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const onLanding = pathname === '/'
  const [scrolled, setScrolled] = useState(!onLanding)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!onLanding) return setScrolled(true)
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [onLanding])

  const dark = !scrolled
  const href = (h) => (onLanding ? h : `/${h}`)

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300',
        scrolled ? 'bg-white/85 shadow-[0_1px_0_rgb(6_26_69/0.06)] backdrop-blur-xl' : 'bg-transparent',
      )}
    >
      <nav className="container-page flex h-16 items-center gap-6" aria-label="Main">
        <Logo dark={dark} />
        <ul className="ml-6 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={href(l.href)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  dark ? 'text-white/75 hover:text-white' : 'text-navy-600 hover:text-navy-950',
                )}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Button to={ROLE_HOME[user.role]} variant={dark ? 'light' : 'dark'} size="md">
              Open Genesis Hub <ArrowRight />
            </Button>
          ) : (
            <>
              <Button to="/login" variant={dark ? 'glass' : 'ghost'} className={cn('max-sm:hidden', dark && 'bg-transparent ring-0')}>
                Log in
              </Button>
              <Button to="/events" variant={dark ? 'light' : 'primary'}>
                Find your photos
              </Button>
            </>
          )}
          <button
            onClick={() => setOpen(true)}
            className={cn('grid size-10 place-items-center rounded-lg lg:hidden', dark ? 'text-white hover:bg-white/10' : 'text-navy-800 hover:bg-navy-100')}
            aria-label="Open menu"
          >
            <MenuIcon className="size-5" />
          </button>
        </div>
      </nav>

      <Drawer open={open} onClose={() => setOpen(false)} title="Menu">
        <ul className="grid gap-1 p-4">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={href(l.href)} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-[17px] font-medium text-navy-900 hover:bg-navy-50">
                {l.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 border-t border-navy-100 p-4">
          {user ? (
            <Button to={ROLE_HOME[user.role]} size="lg" onClick={() => setOpen(false)}>
              Open Genesis Hub
            </Button>
          ) : (
            <>
              <Button to="/events" size="lg" onClick={() => setOpen(false)}>
                Find your photos
              </Button>
              <Button to="/login" size="lg" variant="secondary" onClick={() => setOpen(false)}>
                Log in
              </Button>
            </>
          )}
        </div>
      </Drawer>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="bg-navy-950 text-navy-300">
      <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-xs">
          <Link to="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Genesis Hub home" className="inline-block">
            <GenesisHubLogo dark className="h-24" />
          </Link>
          <p className="mt-5 text-sm leading-relaxed text-navy-400">
            Find every moment you’re in. AI face search for weddings, conferences, festivals and every event in between.
          </p>
        </div>
        <FooterCol
          title="Product"
          links={[
            ['/#features', 'Features'],
            ['/#how', 'How it works'],
            ['/#organizers', 'For organizers'],
          ]}
        />
        <FooterCol
          title="Trust"
          links={[
            ['/privacy', 'Privacy Policy'],
            ['/terms', 'Terms of Use'],
            ['/consent', 'Biometric consent'],
          ]}
        />
        <FooterCol
          title="Get started"
          links={[
            ['/events', 'Find your photos'],
            ['/login', 'Log in'],
            ['/#faq', 'FAQ'],
          ]}
        />
      </div>
      <div className="border-t border-white/5">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-6 text-[13px] text-navy-400">
          <span>© 2026 Genesis Hub, Inc.</span>
          <span>
            Photography on this page by{' '}
            <a href="https://unsplash.com/?utm_source=genesis_hub&utm_medium=referral" className="underline decoration-navy-600 underline-offset-2 hover:text-white" target="_blank" rel="noreferrer">
              Unsplash
            </a>{' '}
            contributors.
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-4 grid gap-2.5 text-sm">
        {links.map(([to, label]) => (
          <li key={to}>
            {to.startsWith('/#') ? (
              <a href={to} className="hover:text-white">
                {label}
              </a>
            ) : (
              <Link to={to} className="hover:text-white">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function PublicLayout() {
  return (
    <div className="min-h-dvh bg-white">
      <PublicNav />
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
