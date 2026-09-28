// A few Aceternity-style effects, rewritten for this codebase (Tailwind v4 +
// motion). Used sparingly: spotlight on the dark hero, a marquee for event
// types, a word-by-word reveal for the "we found you" moment.
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '../lib/utils'

// Aceternity "Spotlight": a soft, slowly drifting light cone.
export function Spotlight({ className, fill = '#0769ee' }) {
  return (
    <svg
      className={cn('pointer-events-none absolute z-0 h-[169%] w-[138%] animate-[spotlight_2.2s_ease_.3s_1_forwards] opacity-0 lg:w-[84%]', className)}
      viewBox="0 0 3787 2842"
      fill="none"
      aria-hidden
    >
      <style>{`@keyframes spotlight{0%{opacity:0;transform:translate(-72%,-62%) scale(.5)}100%{opacity:1;transform:translate(-50%,-40%) scale(1)}}`}</style>
      <g filter="url(#spot-blur)">
        <ellipse cx="1924.71" cy="273.501" rx="1924.71" ry="273.501" transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)" fill={fill} fillOpacity="0.2" />
      </g>
      <defs>
        <filter id="spot-blur" x="0.860352" y="0.838989" width="3785.16" height="2840.26" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </svg>
  )
}

// Faint dotted grid that fades out towards the edges.
export function GridBackdrop({ className, dark }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: `radial-gradient(${dark ? 'rgb(255 255 255 / 0.09)' : 'rgb(13 26 53 / 0.08)'} 1px, transparent 1px)`,
        backgroundSize: '22px 22px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, #000 30%, transparent 75%)',
      }}
    />
  )
}

// Aceternity "Infinite Moving Cards", simplified to a CSS marquee.
export function Marquee({ children, duration = 40, className, gap = '1rem', reverse = false }) {
  return (
    <div
      className={cn('group relative flex overflow-hidden', className)}
      style={{
        '--marquee-duration': `${duration}s`,
        '--marquee-gap': gap,
        maskImage: 'linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)',
      }}
    >
      <div className="flex w-max shrink-0 animate-marquee group-hover:[animation-play-state:paused]" style={{ gap, animationDirection: reverse ? 'reverse' : undefined }}>
        {children}
        <div className="flex shrink-0" style={{ gap }} aria-hidden>
          {children}
        </div>
      </div>
    </div>
  )
}

// Aceternity "Text Generate Effect": words fade/blur in one after another.
export function TextReveal({ text, className, delay = 0, as: As = 'span' }) {
  const reduce = useReducedMotion()
  const words = text.split(' ')
  return (
    <As className={className}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="inline-block"
          initial={reduce ? false : { opacity: 0, filter: 'blur(8px)', y: 6 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.45, delay: delay + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          {w}
          {i < words.length - 1 && ' '}
        </motion.span>
      ))}
    </As>
  )
}

// Scroll-triggered fade-up used for section content.
export function Reveal({ children, className, delay = 0, y = 16 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
