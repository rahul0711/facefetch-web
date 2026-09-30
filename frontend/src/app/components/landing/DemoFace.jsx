import { cn } from '../../lib/utils'

// An illustrated demo person (not a photo) for the landing page's selfie
// mockups. The drawing is laid out on a 9:19 phone screen (360 x 760) with the
// head inside the camera oval (17%-53% of the height); `crop` shows just the
// head for small avatar-style uses.
const VIEWBOX = { screen: '0 0 360 760', head: '72 140 216 216' }

export default function DemoFace({ crop = 'screen', className }) {
  return (
    <svg viewBox={VIEWBOX[crop]} preserveAspectRatio="xMidYMid slice" className={cn('block', className)} aria-hidden>
      <defs>
        <linearGradient id="df-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f3464" />
          <stop offset="1" stopColor="#061a45" />
        </linearGradient>
        <linearGradient id="df-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2475b" />
          <stop offset="1" stopColor="#b8243a" />
        </linearGradient>
      </defs>
      <rect width="360" height="760" fill="url(#df-bg)" />
      {/* soft background shapes (a blurred room) */}
      <circle cx="60" cy="120" r="70" fill="#2a4a86" opacity="0.5" />
      <circle cx="320" cy="210" r="90" fill="#31467a" opacity="0.45" />
      <circle cx="300" cy="620" r="120" fill="#0f2452" opacity="0.6" />

      {/* hair, behind the head */}
      <path d="M180 142c-62 0-104 44-104 112 0 52 10 108 26 150h156c16-42 26-98 26-150 0-68-42-112-104-112z" fill="#1c1320" />

      {/* shoulders and top */}
      <path d="M180 392c-70 0-128 30-146 92-10 36-14 120-14 276h320c0-156-4-240-14-276-18-62-76-92-146-92z" fill="url(#df-top)" />
      {/* neck */}
      <path d="M152 340h56v44c0 16-12 28-28 28s-28-12-28-28z" fill="#b97a56" />
      <path d="M152 362c16 10 40 10 56 0v10c-16 10-40 10-56 0z" fill="#a4694a" opacity="0.6" />

      {/* face */}
      <ellipse cx="180" cy="262" rx="74" ry="94" fill="#d39168" />
      {/* ears */}
      <ellipse cx="106" cy="268" rx="11" ry="18" fill="#c7845c" />
      <ellipse cx="254" cy="268" rx="11" ry="18" fill="#c7845c" />
      <circle cx="106" cy="292" r="4" fill="#f5c542" />
      <circle cx="254" cy="292" r="4" fill="#f5c542" />

      {/* fringe */}
      <path d="M108 236c10-52 44-80 76-80 40 0 66 26 72 70-26-28-66-42-110-30-14 4-26 18-38 40z" fill="#1c1320" />

      {/* brows, eyes, nose, smile */}
      <path d="M138 236c10-8 26-9 36-3" stroke="#2a1a1a" strokeWidth="5" strokeLinecap="round" fill="none" />
      <path d="M186 233c10-6 26-5 36 3" stroke="#2a1a1a" strokeWidth="5" strokeLinecap="round" fill="none" />
      <ellipse cx="156" cy="258" rx="8" ry="9" fill="#2a1a1a" />
      <ellipse cx="204" cy="258" rx="8" ry="9" fill="#2a1a1a" />
      <circle cx="158.5" cy="255" r="2.5" fill="#fff" />
      <circle cx="206.5" cy="255" r="2.5" fill="#fff" />
      <path d="M180 268c-3 14-6 22-2 26 3 2 8 1 11-1" stroke="#a4694a" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M150 308c16 20 44 20 60 0-18 6-42 6-60 0z" fill="#fff" stroke="#8c2f3a" strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="140" cy="292" rx="12" ry="7" fill="#e07a6b" opacity="0.35" />
      <ellipse cx="220" cy="292" rx="12" ry="7" fill="#e07a6b" opacity="0.35" />
      <circle cx="180" cy="218" r="4" fill="#c0283f" />
    </svg>
  )
}
