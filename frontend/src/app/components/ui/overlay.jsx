import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/utils'

// Focus trap + Escape + scroll lock shared by Modal and Drawer.
function useDialog(open, onClose) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => {
      const el = ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('button, [href], input, select, textarea')
      el?.focus()
    }, 30)
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab' || !ref.current) return
      const f = [...ref.current.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select, textarea, [tabindex="0"]')]
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault()
        f.at(-1).focus()
      } else if (!e.shiftKey && document.activeElement === f.at(-1)) {
        e.preventDefault()
        f[0].focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      prev?.focus?.()
    }
  }, [open, onClose])
  return ref
}

export function Modal({ open, onClose, title, description, children, footer, size = 'md', className }) {
  const ref = useDialog(open, onClose)
  const titleId = useId()
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            className="absolute inset-0 bg-navy-950/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className={cn(
              'relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop sm:rounded-2xl',
              size === 'sm' && 'sm:max-w-md',
              size === 'md' && 'sm:max-w-lg',
              size === 'lg' && 'sm:max-w-2xl',
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-2">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-navy-950">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-navy-500">{description}</p>}
              </div>
              <button onClick={onClose} className="-mr-2 -mt-1 grid size-9 place-items-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-800" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
            {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-navy-100 bg-navy-50/50 px-6 py-4 pb-safe">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export function Drawer({ open, onClose, title, description, children, footer, side = 'right', className }) {
  const ref = useDialog(open, onClose)
  const titleId = useId()
  const from = side === 'right' ? { x: '100%' } : { x: '-100%' }
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <motion.div className="absolute inset-0 bg-navy-950/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={from}
            animate={{ x: 0 }}
            exit={from}
            transition={{ type: 'spring', stiffness: 380, damping: 40 }}
            className={cn(
              'absolute top-0 flex h-full w-full max-w-md flex-col bg-white shadow-pop',
              side === 'right' ? 'right-0' : 'left-0',
              className,
            )}
          >
            {title && (
              <div className="flex items-start justify-between gap-4 border-b border-navy-100 px-6 py-5">
                <div>
                  <h2 id={titleId} className="text-lg font-semibold text-navy-950">
                    {title}
                  </h2>
                  {description && <p className="mt-1 text-sm text-navy-500">{description}</p>}
                </div>
                <button onClick={onClose} className="-mr-2 grid size-9 place-items-center rounded-lg text-navy-400 hover:bg-navy-50 hover:text-navy-800" aria-label="Close">
                  <X className="size-5" />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
            {footer && <div className="flex justify-end gap-2 border-t border-navy-100 px-6 py-4 pb-safe">{footer}</div>}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

// ------------------------------------------------------------------- toasts

const ToastCtx = createContext(() => {})
export const useToast = () => useContext(ToastCtx)

const ICONS = { success: CircleCheck, error: CircleAlert, info: Info }

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const toast = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2)
    setItems((xs) => [...xs.slice(-2), { id, message, tone: opts.tone || 'success', description: opts.description }])
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), opts.duration || 3200)
  }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 max-md:bottom-24" aria-live="polite">
          <AnimatePresence initial={false}>
            {items.map((t) => {
              const Icon = ICONS[t.tone]
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 36 }}
                  className="pointer-events-auto flex max-w-sm items-start gap-3 rounded-2xl bg-navy-950 py-3 pr-4 pl-3.5 text-sm text-white shadow-pop ring-1 ring-white/10"
                  role="status"
                >
                  <Icon className={cn('mt-0.5 size-[18px] shrink-0', t.tone === 'error' ? 'text-red-300' : t.tone === 'info' ? 'text-brand-300' : 'text-cyan-300')} />
                  <span>
                    <span className="font-medium">{t.message}</span>
                    {t.description && <span className="mt-0.5 block text-[13px] text-navy-300">{t.description}</span>}
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}

// -------------------------------------------------------------------- menu

export function Menu({ trigger, items, align = 'right', className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false)
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className={cn(
              'absolute top-full z-50 mt-2 min-w-48 origin-top-right rounded-xl border border-navy-100 bg-white p-1.5 shadow-pop',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            {items.filter(Boolean).map((it, i) =>
              it === '-' ? (
                <div key={i} className="my-1 h-px bg-navy-100" />
              ) : (
                <button
                  key={it.label}
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    it.onClick()
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm',
                    it.danger ? 'text-bad hover:bg-red-50' : 'text-navy-800 hover:bg-navy-50',
                  )}
                >
                  {it.icon && <it.icon className="size-4 opacity-70" aria-hidden />}
                  {it.label}
                </button>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
