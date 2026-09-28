import { Check, ChevronDown } from 'lucide-react'
import { motion } from 'motion/react'
import { useId } from 'react'
import { cn, initials } from '../../lib/utils'

// ------------------------------------------------------------------ surfaces

export function Card({ className, as: As = 'div', interactive, ...props }) {
  return (
    <As
      className={cn(
        'rounded-2xl border border-navy-100 bg-white shadow-card',
        interactive && 'transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-navy-200 hover:shadow-lift',
        className,
      )}
      {...props}
    />
  )
}

export function Divider({ className }) {
  return <hr className={cn('border-navy-100', className)} />
}

// ------------------------------------------------------------------- badges

const TONES = {
  neutral: 'bg-navy-50 text-navy-700 ring-navy-200/70',
  brand: 'bg-brand-50 text-brand-700 ring-brand-200/70',
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200/70',
  warn: 'bg-amber-50 text-amber-800 ring-amber-200/70',
  bad: 'bg-red-50 text-red-700 ring-red-200/70',
  live: 'bg-cyan-50 text-cyan-800 ring-cyan-200/80',
  dark: 'bg-navy-900/70 text-white ring-white/15 backdrop-blur',
}

export function Badge({ tone = 'neutral', className, dot, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 rounded-full bg-current', dot === 'pulse' && 'animate-pulse')} />}
      {children}
    </span>
  )
}

const EVENT_TONE = { Draft: 'neutral', Active: 'live', Completed: 'ok', Archived: 'neutral' }

export function StatusBadge({ status, className, onDark }) {
  return (
    <Badge tone={onDark ? 'dark' : EVENT_TONE[status] || 'neutral'} dot={status === 'Active' ? 'pulse' : true} className={className}>
      {status === 'Active' ? 'Live' : status}
    </Badge>
  )
}

// ------------------------------------------------------------------ avatars

const AVATAR_BG = ['bg-brand-100 text-brand-800', 'bg-cyan-100 text-cyan-900', 'bg-navy-100 text-navy-800', 'bg-indigo-100 text-indigo-800', 'bg-sky-100 text-sky-900']

export function Avatar({ user, size = 36, className, ring }) {
  const name = user?.name || '?'
  const tint = AVATAR_BG[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_BG.length]
  return (
    <span
      className={cn(
        'relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-semibold',
        !user?.avatar && tint,
        ring && 'ring-2 ring-white',
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
    >
      {user?.avatar ? (
        <img src={user.avatar} alt="" className="size-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  )
}

export function AvatarStack({ users = [], max = 3, size = 28 }) {
  const shown = users.slice(0, max)
  const extra = users.length - shown.length
  if (!users.length) return <span className="text-xs text-navy-400">No admins yet</span>
  return (
    <span className="flex items-center">
      {shown.map((u, i) => (
        <Avatar key={u.id} user={u} size={size} ring className={i ? '-ml-2' : ''} />
      ))}
      {extra > 0 && (
        <span
          className="-ml-2 grid place-items-center rounded-full bg-navy-100 text-[11px] font-semibold text-navy-700 ring-2 ring-white"
          style={{ width: size, height: size }}
        >
          +{extra}
        </span>
      )}
    </span>
  )
}

// ---------------------------------------------------------------- skeletons

export function Skeleton({ className, dark, style }) {
  return <span aria-hidden style={style} className={cn('block', dark ? 'skeleton-dark' : 'skeleton', className)} />
}

// -------------------------------------------------------------------- forms

export function Field({ label, hint, error, children, className, htmlFor, optional }) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="flex items-baseline justify-between text-sm font-medium text-navy-800">
          {label}
          {optional && <span className="text-xs font-normal text-navy-400">Optional</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[13px] text-bad" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="text-[13px] text-navy-500">{hint}</p>
      )}
    </div>
  )
}

const inputBase =
  'w-full rounded-[10px] border border-navy-200 bg-white px-3.5 text-[15px] text-navy-900 shadow-card placeholder:text-navy-400 transition-[border-color,box-shadow] outline-none hover:border-navy-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 disabled:bg-navy-50 aria-invalid:border-bad aria-invalid:focus:ring-bad/15'

export function Input({ className, icon: Icon, ...props }) {
  if (!Icon) return <input className={cn(inputBase, 'h-11', className)} {...props} />
  return (
    <span className="relative block">
      <Icon className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
      <input className={cn(inputBase, 'h-11 pl-10', className)} {...props} />
    </span>
  )
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(inputBase, 'min-h-24 py-2.5 leading-relaxed', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <span className="relative block">
      <select className={cn(inputBase, 'h-11 appearance-none pr-10', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-navy-400" aria-hidden />
    </span>
  )
}

export function Switch({ checked, onChange, label, description, disabled, className }) {
  const id = useId()
  return (
    <label htmlFor={id} className={cn('flex items-start justify-between gap-4', disabled && 'opacity-50', className)}>
      {(label || description) && (
        <span className="grid gap-0.5">
          {label && <span className="text-sm font-medium text-navy-900">{label}</span>}
          {description && <span className="text-[13px] text-navy-500">{description}</span>}
        </span>
      )}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors duration-200',
          checked ? 'bg-brand-600' : 'bg-navy-200',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 700, damping: 40 }}
          className={cn('size-5 rounded-full bg-white shadow-sm', checked ? 'ml-[18px]' : 'ml-0.5')}
        />
      </button>
    </label>
  )
}

export function Checkbox({ checked, onChange, className, label, ...props }) {
  return (
    <span className={cn('relative inline-grid size-5 shrink-0 place-items-center', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer size-5 cursor-pointer appearance-none rounded-md border border-navy-300 bg-white transition-colors checked:border-brand-600 checked:bg-brand-600"
        {...props}
      />
      <Check className="pointer-events-none absolute size-3.5 text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} aria-hidden />
    </span>
  )
}

// --------------------------------------------------------------- progress

export function Progress({ value, className, tone = 'brand' }) {
  return (
    <span
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('block h-1.5 overflow-hidden rounded-full bg-navy-100', className)}
    >
      <span
        className={cn(
          'block h-full rounded-full transition-[width] duration-500 ease-out',
          tone === 'brand' && 'bg-gradient-to-r from-brand-600 to-cyan-400',
          tone === 'ok' && 'bg-ok',
          tone === 'bad' && 'bg-bad',
        )}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </span>
  )
}

// --------------------------------------------------------------- segmented

export function Segmented({ options, value, onChange, className, size = 'md', label }) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-xl bg-navy-100/70 p-1', className)}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value
        const text = typeof o === 'string' ? o : o.label
        const active = v === value
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={cn(
              'relative rounded-lg font-medium whitespace-nowrap transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm',
              active ? 'text-navy-950' : 'text-navy-500 hover:text-navy-800',
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-lg bg-white shadow-[0_1px_3px_rgb(6_26_69/0.12)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {text}
              {o.count != null && <span className="text-xs text-navy-400 tabular-nums">{o.count}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// -------------------------------------------------------------- empty state

export function EmptyState({ icon: Icon, title, children, action, className, art }) {
  return (
    <div className={cn('mx-auto grid max-w-md justify-items-center px-6 py-14 text-center', className)}>
      {art ||
        (Icon && (
          <span className="relative mb-5 grid size-16 place-items-center rounded-2xl bg-gradient-to-b from-white to-navy-50 text-brand-600 shadow-lift ring-1 ring-navy-100">
            <Icon className="size-7" strokeWidth={1.6} aria-hidden />
          </span>
        ))}
      <h3 className="text-lg font-semibold text-navy-950">{title}</h3>
      {children && <p className="mt-1.5 text-[15px] leading-relaxed text-navy-500">{children}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

// -------------------------------------------------------------- page header

export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-[13px] font-medium text-brand-700">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold text-navy-950 sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[15px] text-navy-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Kbd({ children }) {
  return (
    <kbd className="rounded-md border border-white/20 bg-white/10 px-1.5 py-0.5 font-sans text-[11px] text-white/80">{children}</kbd>
  )
}
