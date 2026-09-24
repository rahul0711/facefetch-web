import { LoaderCircle } from 'lucide-react'
import { Link } from 'react-router'
import { cn } from '../../lib/utils'

const VARIANTS = {
  primary:
    'bg-brand-600 text-white shadow-[0_1px_0_rgb(255_255_255/0.18)_inset,0_1px_2px_rgb(6_26_69/0.2)] hover:bg-brand-700 active:bg-brand-800',
  dark: 'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950',
  secondary: 'bg-white text-navy-900 ring-1 ring-navy-200 ring-inset shadow-card hover:bg-navy-50 hover:ring-navy-300',
  ghost: 'text-navy-700 hover:bg-navy-100/70 hover:text-navy-900',
  destructive: 'bg-bad text-white hover:bg-red-700',
  'destructive-ghost': 'text-bad hover:bg-red-50',
  glass: 'bg-white/10 text-white ring-1 ring-inset ring-white/20 backdrop-blur hover:bg-white/15',
  light: 'bg-white text-navy-950 hover:bg-navy-50',
}

const SIZES = {
  sm: 'h-8 gap-1.5 rounded-lg px-3 text-[13px]',
  md: 'h-10 gap-2 rounded-[10px] px-4 text-sm',
  lg: 'h-12 gap-2 rounded-xl px-5 text-[15px]',
  xl: 'h-14 gap-2.5 rounded-2xl px-7 text-base',
  icon: 'size-10 rounded-[10px]',
  'icon-sm': 'size-8 rounded-lg',
}

export function buttonClass({ variant = 'primary', size = 'md', className } = {}) {
  return cn(
    'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap select-none',
    'transition-[background-color,box-shadow,color,transform] duration-150 active:scale-[0.98]',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0',
    VARIANTS[variant],
    SIZES[size],
    className,
  )
}

export default function Button({ variant, size, className, loading, children, to, href, ...props }) {
  const cls = buttonClass({ variant, size, className })
  const content = (
    <>
      {loading && <LoaderCircle className="animate-spin" aria-hidden />}
      {children}
    </>
  )
  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {content}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} className={cls} {...props}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" className={cls} disabled={loading || props.disabled} {...props}>
      {content}
    </button>
  )
}
