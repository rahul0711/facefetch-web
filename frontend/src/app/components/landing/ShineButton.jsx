import { Link } from 'react-router'
import { cn } from '../../lib/utils'

// Primary landing CTA: a solid brand button whose border is a slowly spinning
// light (uiverse-style conic border), so the one action that matters glows.
export default function ShineButton({ to, children, className }) {
  return (
    <Link
      to={to}
      className={cn(
        'group relative inline-flex h-14 animate-border-spin items-center justify-center gap-2.5 rounded-2xl border border-transparent px-7 text-base font-semibold text-white',
        'shadow-[0_10px_40px_-8px_rgb(7_105_238/0.8)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 [&_svg]:size-5',
        className,
      )}
      style={{
        background:
          'linear-gradient(180deg, #1f72f2, #0759e0) padding-box, conic-gradient(from var(--border-angle), rgb(114 209 251 / 0.15) 0%, rgb(114 209 251 / 0.15) 60%, #72d1fb 80%, #ffffff 85%, #72d1fb 90%, rgb(114 209 251 / 0.15) 100%) border-box',
      }}
    >
      <span aria-hidden className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <span className="relative inline-flex items-center gap-2.5">{children}</span>
    </Link>
  )
}
