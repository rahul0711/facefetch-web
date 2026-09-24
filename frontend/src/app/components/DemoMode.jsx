import { FlaskConical, RotateCcw, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { cn } from '../lib/utils'
import { DEMO_ACCOUNTS, ROLE_HOME } from '../services/authService'
import { resetDemo } from '../services/db'
import { useToast } from './ui/overlay'

// Developer-only control for jumping between the three demo roles. Kept
// small and deliberately "tool-like" so it never reads as a product feature.
export default function DemoMode({ raised }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const { user, loginAsRole, logout } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const become = async (role) => {
    setBusy(role)
    try {
      await loginAsRole(role)
      setOpen(false)
      navigate(ROLE_HOME[role])
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={cn('fixed right-4 bottom-4 z-[70]', raised && 'max-md:bottom-[92px]')}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 bottom-12 w-64 origin-bottom-right rounded-xl bg-navy-950 p-2 text-white shadow-pop ring-1 ring-white/10"
            role="dialog"
            aria-label="Demo mode"
          >
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="font-mono text-[11px] tracking-wider text-navy-400 uppercase">Demo role</span>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-navy-400 hover:text-white" aria-label="Close demo mode">
                <X className="size-3.5" />
              </button>
            </div>
            {DEMO_ACCOUNTS.map((a) => {
              const active = user?.role === a.role
              return (
                <button
                  key={a.role}
                  onClick={() => become(a.role)}
                  disabled={!!busy}
                  className={cn('flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-white/5', active && 'bg-white/[0.07]')}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', active ? 'bg-cyan-400' : 'bg-navy-600')} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{busy === a.role ? 'Signing in…' : a.label}</span>
                    <span className="block truncate text-[11px] text-navy-400">{a.email}</span>
                  </span>
                </button>
              )
            })}
            <div className="mt-1 flex gap-1 border-t border-white/10 pt-2">
              {user && (
                <button
                  onClick={() => {
                    logout()
                    setOpen(false)
                    navigate('/')
                  }}
                  className="flex-1 rounded-lg px-2 py-1.5 text-[12px] text-navy-300 hover:bg-white/5 hover:text-white"
                >
                  Sign out
                </button>
              )}
              <button
                onClick={() => {
                  resetDemo()
                  toast('Demo data reset', { tone: 'info' })
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-navy-300 hover:bg-white/5 hover:text-white"
              >
                <RotateCcw className="size-3" /> Reset data
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-1.5 rounded-full bg-navy-950/90 font-mono text-[11px] tracking-wide text-navy-200 shadow-lift ring-1 ring-white/10 backdrop-blur hover:text-white max-sm:w-9 max-sm:justify-center sm:px-3"
        aria-expanded={open}
        aria-label="Demo mode"
      >
        <FlaskConical className="size-3.5 text-cyan-300" />
        <span className="max-sm:hidden">DEMO</span>
      </button>
    </div>
  )
}
