import { ScanFace } from 'lucide-react'
import { motion } from 'motion/react'
import Logo, { PixelCluster } from '../../components/ui/Logo'
import { pool } from '../../data/gallery'
import { GridBackdrop } from '../../components/effects'

// Split-screen shell for login/signup: form on the left, a quiet photo
// collage with a found-you moment on the right.
export default function AuthShell({ children }) {
  const photos = [pool('wedding')[4], pool('party')[6], pool('collegefest')[15], pool('wedding')[10], pool('summit')[12], pool('party')[9]].filter(Boolean)
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">{children}</div>
        <p className="text-center text-[13px] text-navy-400">© 2026 Genesis Hub, Inc. · Prototype: accounts and data are demo only</p>
      </div>
      <div className="relative hidden overflow-hidden bg-navy-950 lg:block">
        <GridBackdrop dark />
        <PixelCluster dark className="absolute top-10 right-10 z-10 size-16 opacity-90" />
        <div className="absolute inset-0 grid -rotate-6 scale-110 grid-cols-3 gap-4 p-10 opacity-60">
          {[...photos, ...photos].map((p, i) => (
            <img key={i} src={p.src} alt="" className="aspect-[3/4] w-full rounded-2xl object-cover" style={{ transform: `translateY(${(i % 3) * 30}px)` }} />
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/60 to-navy-950/20" />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="absolute inset-x-10 bottom-12 xl:inset-x-16"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-400/10 px-3 py-1 text-[13px] font-medium text-cyan-200 ring-1 ring-cyan-300/25">
            <ScanFace className="size-4" /> 24 moments found at TechFest 2026
          </span>
          <p className="mt-5 max-w-lg text-3xl leading-tight font-semibold text-white">“I found every photo of me from a 3,000-person fest in about five seconds.”</p>
          <p className="mt-3 text-navy-300">Isha, guest at TechFest 2026</p>
        </motion.div>
      </div>
    </div>
  )
}
