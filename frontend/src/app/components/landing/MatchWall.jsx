import { cn } from '../../lib/utils'
import { byIds, largestFace, thumb } from '../../data/gallery'
import { FaceBox } from '../Photo'

// The hero's moving photo wall. Five columns drift up and down; every 8s a
// scan beam sweeps across, the photos you're not in fade out, and the ones
// you are in stay lit with a ring around your face. All CSS (styles.css:
// wall-*), so it stays smooth on phones.
const COLUMNS = [
  ['JjOm8445mXw', 'DVmEj6ptFbc', 'CnAgA4rmGUQ', 'LO1lToLGGFA', 'nPz8akkUmDI', '_HzlOHmboSk'],
  ['0O26oGDg-Hg', 'Y8XxrkzwdyI', 'dHQf0wGQTzk', 'zc6ezUR4-8I', 'X_LG2v07co8', 'IhVom0KsuOM'],
  ['8vmvtj_W4xQ', 'QbGPGsliC5w', '3EMw3T-ZjkE', 'U4KutCl_GKg', 'rLemzQ0FDxY', 'WJPHTJEtgzw'],
  ['mJzQAjnleKs', 'uv4h7wIQcHQ', 'ee9plLQf41E', 'XMGaBN4fM58', 'fReOa8L2Ijc', 'wmhehhmeA1o'],
  ['SdTKkcdz9mY', 'hGHldbCgYDA', 'HD34Wd6Jjqc', 'tYPkWLWVVOo', 'GLKM5guF69Y', 'zrnQPd5w8-U'],
]
// "You": photos with one clear, large face to ring.
const MATCHED = new Set(['DVmEj6ptFbc', 'LO1lToLGGFA', '0O26oGDg-Hg', 'zc6ezUR4-8I', 'QbGPGsliC5w', 'ee9plLQf41E', 'wmhehhmeA1o'])
const SPEEDS = ['70s', '90s', '64s', '84s', '76s']

function Tile({ p }) {
  const matched = MATCHED.has(p.id)
  const face = matched ? largestFace(p) : null
  return (
    <div
      className={cn('relative overflow-hidden rounded-xl bg-navy-900 ring-1 ring-white/10', !matched && 'animate-wall-dim')}
      style={{ aspectRatio: `${p.width} / ${p.height}`, backgroundColor: p.color }}
    >
      <img src={p.src} alt="" loading="eager" decoding="async" className="size-full object-cover" />
      {face && (
        <span className="absolute inset-0 animate-wall-found">
          <FaceBox box={face} animate={false} />
          <span
            className="absolute rounded-full bg-cyan-300 px-2 py-0.5 text-[10px] font-bold tracking-wide text-navy-950 uppercase shadow-lg"
            style={{ left: `${face[0] * 100}%`, top: `${Math.min(face[3] + 0.04, 0.9) * 100}%` }}
          >
            You
          </span>
        </span>
      )}
    </div>
  )
}

export default function MatchWall({ className }) {
  const cols = COLUMNS.map((ids) => byIds(ids).map(thumb))
  return (
    <div aria-hidden className={cn('pointer-events-none absolute overflow-hidden', className)}>
      <div
        className="absolute -inset-[12%] grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5"
        style={{ transform: 'perspective(1600px) rotateX(16deg) rotateY(-12deg) rotateZ(5deg)', transformOrigin: '50% 40%' }}
      >
        {cols.map((photos, i) => (
          <div key={i} className={cn('relative', i === 4 && 'max-lg:hidden', i === 3 && 'max-sm:hidden')}>
            <div
              className={cn('grid gap-3', i % 2 ? 'animate-wall-down' : 'animate-wall-up')}
              style={{ '--wall-duration': SPEEDS[i] }}
            >
              {/* twice, so the loop is seamless */}
              {[...photos, ...photos].map((p, j) => (
                <Tile key={`${p.id}-${j}`} p={p} />
              ))}
            </div>
          </div>
        ))}
        {/* the scan beam */}
        <span className="absolute inset-x-0 h-28 animate-wall-beam">
          <span className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-b from-transparent via-cyan-300/10 to-cyan-300/30" />
          <span className="absolute inset-x-0 bottom-0 h-px bg-cyan-200 shadow-[0_0_24px_4px_rgb(5_176_246/0.8)]" />
        </span>
      </div>
    </div>
  )
}
