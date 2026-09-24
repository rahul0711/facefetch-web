import { Link } from 'react-router'
import { cn } from '../../lib/utils'

// Brand assets, cut from the official Genesis Hub logo (public/logo/logo.jpeg):
//  *-mark   = the GH monogram with its pixel squares
//  *-logo   = the full stacked lockup
//  *-light  = reversed for dark surfaces (navy -> white, blues kept)
const SRC = {
  mark: '/brand/genesis-hub-mark.webp',
  markLight: '/brand/genesis-hub-mark-light.webp',
  full: '/brand/genesis-hub-logo.webp',
  fullLight: '/brand/genesis-hub-logo-light.webp',
}

// The GH monogram. `size` is its height in px.
export function LogoMark({ size = 32, className, dark }) {
  return (
    <img
      src={dark ? SRC.markLight : SRC.mark}
      alt=""
      aria-hidden
      draggable={false}
      style={{ height: size, width: 'auto' }}
      className={cn('shrink-0 select-none', className)}
    />
  )
}

// Horizontal lockup for navigation: monogram + wordmark, coloured like the
// logo ("Genesis" navy, "Hub" blue).
export default function Logo({ to = '/', dark, className, size = 32 }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 rounded-lg', className)} aria-label="Genesis Hub home">
      <LogoMark size={size} dark={dark} />
      <span className={cn('font-display text-[18px] font-bold tracking-[-0.015em] whitespace-nowrap', dark ? 'text-white' : 'text-navy-950')}>
        Genesis <span className={dark ? 'text-cyan-400' : 'text-brand-700'}>Hub</span>
      </span>
    </Link>
  )
}

// The full stacked logo (monogram over "Genesis Hub, Inc.").
export function GenesisHubLogo({ className, dark, variant = 'full' }) {
  const src = variant === 'mark' ? (dark ? SRC.markLight : SRC.mark) : dark ? SRC.fullLight : SRC.full
  return <img src={src} alt="Genesis Hub, Inc." draggable={false} className={cn('h-full w-auto select-none', className)} loading="lazy" />
}

// Decorative cluster of squares echoing the logo's trailing pixels.
export function PixelCluster({ className, dark }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('pointer-events-none', className)} aria-hidden>
      <rect x="30" y="0" width="8" height="8" fill="#05b0f6" />
      <rect x="17" y="8" width="7" height="7" fill={dark ? '#98acd3' : '#020e39'} />
      <rect x="28" y="16" width="9" height="9" fill="#0769ee" />
      <rect x="11" y="22" width="7" height="7" fill={dark ? '#c5d2eb' : '#061a45'} />
      <rect x="21" y="31" width="7" height="7" fill="#1f72f2" />
    </svg>
  )
}
