// Small, dependency-free SVG charts for the admin consoles.
// Conventions: one hue per series (brand blue), 2px lines, rounded bar ends
// anchored to the baseline, recessive grid, hover tooltip on every mark, and
// a visually hidden table so the data is never chart-only.
import { CircleAlert, CircleCheck, CloudUpload, LoaderCircle, TrendingDown, TrendingUp } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn, compact, fmtDate, num } from '../lib/utils'

const SERIES = '#0759e0' // brand-600
const GRID = '#e2e9f6' // navy-100
const AXIS_TEXT = '#6a80b0' // navy-400

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function niceMax(v) {
  if (v <= 0) return 10
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

function SrTable({ caption, rows, unit }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th>Date</th>
          <th>{unit}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.date}>
            <td>{fmtDate(r.date)}</td>
            <td>{r.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Tooltip({ x, y, width, children }) {
  const left = Math.min(Math.max(x, 60), width - 60)
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-navy-950 px-2.5 py-1.5 text-center text-xs whitespace-nowrap text-white shadow-lift"
      style={{ left, top: y - 10 }}
    >
      {children}
    </div>
  )
}

// ------------------------------------------------------------------ area

export function AreaChart({ data, height = 220, unit = 'Searches', label }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const gid = useId().replace(/:/g, '')
  const pad = { t: 12, r: 8, b: 26, l: 36 }
  const w = Math.max(0, width - pad.l - pad.r)
  const h = height - pad.t - pad.b
  const max = niceMax(Math.max(...data.map((d) => d.value)))
  const x = (i) => pad.l + (data.length < 2 ? w / 2 : (i / (data.length - 1)) * w)
  const y = (v) => pad.t + h - (v / max) * h
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('')
  const area = `${line}L${x(data.length - 1)},${pad.t + h}L${x(0)},${pad.t + h}Z`
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const labelEvery = Math.ceil(data.length / (width < 480 ? 4 : 6))

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = e.clientX - r.left - pad.l
    setHover(Math.max(0, Math.min(data.length - 1, Math.round((px / w) * (data.length - 1)))))
  }

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && data.length > 0 && (
        <svg width={width} height={height} role="img" aria-label={label || `${unit} over time`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="touch-none">
          <defs>
            <linearGradient id={`a-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={SERIES} stopOpacity="0.16" />
              <stop offset="1" stopColor={SERIES} stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + w} y1={y(t)} y2={y(t)} stroke={GRID} strokeDasharray={t ? '3 4' : undefined} />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize="11" fill={AXIS_TEXT}>
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % labelEvery === 0 ? (
              <text key={d.date} x={x(i)} y={height - 6} textAnchor="middle" fontSize="11" fill={AXIS_TEXT}>
                {fmtDate(d.date, { day: 'numeric', month: 'short' })}
              </text>
            ) : null,
          )}
          <path d={area} fill={`url(#a-${gid})`} />
          <path d={line} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {hover != null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke="#98acd3" strokeWidth="1" />
              <circle cx={x(hover)} cy={y(data[hover].value)} r="5" fill={SERIES} stroke="#fff" strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
      {hover != null && data[hover] && (
        <Tooltip x={x(hover)} y={y(data[hover].value)} width={width}>
          <div className="font-semibold tabular-nums">
            {num(data[hover].value)} {unit.toLowerCase()}
          </div>
          <div className="text-navy-300">{fmtDate(data[hover].date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
        </Tooltip>
      )}
      <SrTable caption={label || unit} rows={data} unit={unit} />
    </div>
  )
}

// ------------------------------------------------------------------- bars

export function BarChart({ data, height = 200, unit = 'Photos', label }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const pad = { t: 12, r: 4, b: 26, l: 36 }
  const w = Math.max(0, width - pad.l - pad.r)
  const h = height - pad.t - pad.b
  const max = niceMax(Math.max(...data.map((d) => d.value)))
  const gap = 2
  const bw = Math.max(2, w / data.length - gap)
  const labelEvery = Math.ceil(data.length / (width < 480 ? 4 : 6))

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={label || `${unit} over time`} onPointerLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + w} y1={pad.t + h - t * h} y2={pad.t + h - t * h} stroke={GRID} strokeDasharray={t ? '3 4' : undefined} />
              <text x={pad.l - 8} y={pad.t + h - t * h} dy="0.32em" textAnchor="end" fontSize="11" fill={AXIS_TEXT}>
                {compact(t * max)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const bh = Math.max(1, (d.value / max) * h)
            const bx = pad.l + i * (bw + gap) + gap / 2
            const by = pad.t + h - bh
            const r = Math.min(4, bw / 2, bh)
            return (
              <g key={d.date} onPointerEnter={() => setHover(i)}>
                {/* generous hit target */}
                <rect x={bx - gap / 2} y={pad.t} width={bw + gap} height={h} fill="transparent" />
                <path
                  d={`M${bx},${by + bh}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + bw - r}Q${bx + bw},${by} ${bx + bw},${by + r}V${by + bh}Z`}
                  fill={SERIES}
                  opacity={hover == null || hover === i ? 1 : 0.45}
                />
                {i % labelEvery === 0 && (
                  <text x={bx + bw / 2} y={height - 6} textAnchor="middle" fontSize="11" fill={AXIS_TEXT}>
                    {fmtDate(d.date, { day: 'numeric', month: 'short' })}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}
      {hover != null && (
        <Tooltip x={pad.l + hover * (bw + gap) + bw / 2} y={pad.t + h - (data[hover].value / max) * h} width={width}>
          <div className="font-semibold tabular-nums">
            {num(data[hover].value)} {unit.toLowerCase()}
          </div>
          <div className="text-navy-300">{fmtDate(data[hover].date, { day: 'numeric', month: 'short' })}</div>
        </Tooltip>
      )}
      <SrTable caption={label || unit} rows={data} unit={unit} />
    </div>
  )
}

// ---------------------------------------------------------------- bar list

export function BarList({ items, unit = 'searches', onSelect }) {
  const max = Math.max(1, ...items.map((i) => i.value))
  return (
    <ul className="grid gap-3.5">
      {items.map((it) => (
        <li key={it.id}>
          <button onClick={() => onSelect?.(it)} className={cn('group block w-full text-left', !onSelect && 'cursor-default')} title={`${num(it.value)} ${unit}`}>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium text-navy-800 group-hover:text-navy-950">{it.name}</span>
              <span className="shrink-0 text-navy-500 tabular-nums">{num(it.value)}</span>
            </span>
            <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-navy-50">
              <span className="block h-full rounded-full bg-brand-600 transition-[width] duration-700" style={{ width: `${(it.value / max) * 100}%` }} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// --------------------------------------------------------- status stack

const STATUS = [
  { key: 'processed', label: 'Processed', color: '#0ca30c', icon: CircleCheck },
  { key: 'analyzing', label: 'Analyzing', color: '#fab219', icon: LoaderCircle },
  { key: 'uploading', label: 'Uploading', color: '#98acd3', icon: CloudUpload },
  { key: 'failed', label: 'Failed', color: '#d03b3b', icon: CircleAlert },
]

export function StatusStack({ counts }) {
  const total = STATUS.reduce((n, s) => n + (counts[s.key] || 0), 0)
  const segs = STATUS.filter((s) => counts[s.key])
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full bg-navy-50" role="img" aria-label={segs.map((s) => `${s.label} ${counts[s.key]}`).join(', ')}>
        {segs.map((s) => (
          <span key={s.key} title={`${s.label}: ${num(counts[s.key])}`} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(counts[s.key] / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-3">
        {STATUS.map(({ key, label, color, icon: Icon }) => (
          <li key={key} className="flex items-center gap-2 text-sm">
            <Icon className="size-4 shrink-0" style={{ color }} aria-hidden />
            <span className="text-navy-600">{label}</span>
            <span className="ml-auto font-medium text-navy-900 tabular-nums">{num(counts[key] || 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// -------------------------------------------------------------- stat card

export function StatCard({ label, value, icon: Icon, delta, hint, className }) {
  const up = delta != null && delta >= 0
  return (
    <div className={cn('rounded-2xl border border-navy-100 bg-white p-5 shadow-card', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-navy-500">{label}</span>
        {Icon && (
          <span className="grid size-8 place-items-center rounded-lg bg-navy-50 text-navy-600">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-3 text-[28px] leading-none font-semibold tracking-tight text-navy-950 tabular-nums">{value}</div>
      {(delta != null || hint) && (
        <div className="mt-2.5 flex items-center gap-1.5 text-[13px]">
          {delta != null && (
            <span className={cn('inline-flex items-center gap-1 font-medium', up ? 'text-emerald-700' : 'text-red-700')}>
              {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
              {up ? '+' : ''}
              {Math.round(delta * 100)}%
            </span>
          )}
          {hint && <span className="text-navy-400">{hint}</span>}
        </div>
      )}
    </div>
  )
}

export function Panel({ title, description, action, children, className }) {
  return (
    <section className={cn('rounded-2xl border border-navy-100 bg-white p-5 shadow-card sm:p-6', className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy-950">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-navy-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
