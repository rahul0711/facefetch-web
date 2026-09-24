import { motion } from 'motion/react'
import { useState } from 'react'
import { cn } from '../lib/utils'

export function FaceBox({ box, className, animate = true, delay = 0 }) {
  const [x1, y1, x2, y2] = box
  // Pad the detector box a little so the ring frames the face, not the skin.
  const px = (x2 - x1) * 0.14
  const py = (y2 - y1) * 0.1
  const style = {
    left: `${(x1 - px) * 100}%`,
    top: `${(y1 - py) * 100}%`,
    width: `${(x2 - x1 + 2 * px) * 100}%`,
    height: `${(y2 - y1 + 2 * py) * 100}%`,
  }
  if (!animate) return <span className={cn('face-ring', className)} style={style} />
  return (
    <motion.span
      className={cn('face-ring', className)}
      style={style}
      initial={{ opacity: 0, scale: 1.35 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    />
  )
}

// A photo that never stretches: fills its box with object-cover (or shows
// the whole frame with contain), fades in over its dominant colour.
export default function Photo({
  photo,
  className,
  imgClassName,
  fit = 'cover',
  ratio, // 'natural' | css aspect-ratio string | undefined (fill parent)
  face, // [x1,y1,x2,y2] -> draws the face ring (only exact with fit=cover when ratio is natural)
  faceDelay,
  sizes,
  eager,
  children,
  alt,
}) {
  const [loaded, setLoaded] = useState(false)
  const aspect = ratio === 'natural' ? `${photo.width} / ${photo.height}` : ratio
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ aspectRatio: aspect, backgroundColor: photo.color || '#0f2452' }}
    >
      {photo.src && (
        <img
          src={photo.src}
          alt={alt ?? photo.alt ?? ''}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          sizes={sizes}
          onLoad={() => setLoaded(true)}
          className={cn(
            'size-full transition-[opacity,transform,filter] duration-500',
            fit === 'cover' ? 'object-cover' : 'object-contain',
            loaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm',
            imgClassName,
          )}
        />
      )}
      {face && loaded && <FaceBox box={face} delay={faceDelay} />}
      {children}
    </div>
  )
}
