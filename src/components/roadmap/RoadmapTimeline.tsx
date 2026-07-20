// Owner-decision timeline — clean SVG (recharts can't draw Gantt chains).
// One row per construction window: back-cast chain (decision dot → design →
// buyout → fabrication segments) flowing into the window band, long-lead
// order-by diamonds on their serving window's row, and a dashed "today" line.
// Past-due dates render in the alert color with the at-risk treatment.
import { KIND_COLORS } from '../../lib/analytics'
import { fmtMillions } from '../../lib/format'
import { TRADE_ACCENT, TRADE_SHORT } from '../../lib/trades'
import {
  AXIS_END,
  AXIS_START,
  fmtDay,
  fmtMonthYr,
} from '../../lib/roadmap'
import type { LongLeadMark, WindowRow } from '../../lib/roadmap'
import type { WindowPhaseId } from '../../data/arenaGeometry'

const W = 1440
const GUTTER = 128 // left row-label gutter
const PAD_R = 20
const AXIS_H = 30 // tick labels row at top
const ROW_PITCH = 50
const ROW0 = AXIS_H + 26
const CHAIN_H = 8
const BAND_H = 18
const ALERT = '#D83C31'
const INK = '#36383D'

const SEG_COLORS = {
  design: '#d5d7d4',
  buyout: '#b0b5b1',
} as const

function x(d: Date): number {
  const t0 = AXIS_START.getTime()
  const t1 = AXIS_END.getTime()
  return GUTTER + ((d.getTime() - t0) / (t1 - t0)) * (W - GUTTER - PAD_R)
}

// Six-month ticks: Jan/Jul from Jan 2026 through Jan 2030.
function axisTicks(): Date[] {
  const ticks: Date[] = []
  for (let year = 2026; year <= 2030; year++) {
    for (const m of [0, 6]) {
      const d = new Date(Date.UTC(year, m, 1))
      if (d >= AXIS_START && d <= AXIS_END) ticks.push(d)
    }
  }
  return ticks
}

function Diamond({ cx, cy, r, fill, stroke }: { cx: number; cy: number; r: number; fill: string; stroke: string }) {
  return (
    <path
      d={`M ${cx},${cy - r} L ${cx + r},${cy} L ${cx},${cy + r} L ${cx - r},${cy} Z`}
      fill={fill}
      stroke={stroke}
      strokeWidth={0.8}
    />
  )
}

export interface RoadmapTimelineProps {
  rows: WindowRow[]
  marks: LongLeadMark[]
  today: Date
  moneyByPhase: Record<WindowPhaseId, number>
}

export default function RoadmapTimeline({ rows, marks, today, moneyByPhase }: RoadmapTimelineProps) {
  const H = ROW0 + rows.length * ROW_PITCH + 8
  const ticks = axisTicks()
  const todayX = x(today)

  // Marks grouped per row; stagger vertically when two land close together.
  const marksByRow = new Map<WindowPhaseId, LongLeadMark[]>()
  for (const m of marks) {
    const arr = marksByRow.get(m.window)
    if (arr) arr.push(m)
    else marksByRow.set(m.window, [m])
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ maxHeight: '46vh' }}
      role="img"
      aria-label="Owner decision timeline"
    >
      {/* Month gridlines + labels. */}
      {ticks.map((t) => {
        const tx = x(t)
        const isJan = t.getUTCMonth() === 0
        return (
          <g key={t.getTime()}>
            <line x1={tx} y1={AXIS_H} x2={tx} y2={H - 4} stroke="#ececeb" strokeWidth={1} />
            <text
              x={tx}
              y={AXIS_H - 8}
              textAnchor="middle"
              fontSize={11}
              fontWeight={isJan ? 700 : 400}
              fill={isJan ? INK : '#A6A6A6'}
            >
              {fmtMonthYr(t)}
            </text>
          </g>
        )
      })}

      {/* Window rows. */}
      {rows.map((r, i) => {
        const yc = ROW0 + i * ROW_PITCH
        const kindColor = KIND_COLORS[r.kind]
        const decisionColor = r.atRisk ? ALERT : INK
        const rowMarks = marksByRow.get(r.phase) ?? []
        return (
          <g key={r.phase}>
            {/* Row label: window short + escalated $ context. */}
            <text x={12} y={yc - 2} fontSize={12} fontWeight={700} fill={INK}>
              {r.short}
            </text>
            <text x={12} y={yc + 12} fontSize={11} fill="#A6A6A6" className="tabular-nums">
              {fmtMillions(moneyByPhase[r.phase] ?? 0)}
            </text>

            {/* Back-cast chain: design → buyout → fabrication. */}
            <rect
              x={x(r.decision)}
              y={yc - CHAIN_H / 2}
              width={Math.max(1, x(r.buyoutStart) - x(r.decision))}
              height={CHAIN_H}
              fill={r.atRisk ? `${ALERT}33` : SEG_COLORS.design}
            >
              <title>{`Design development + documents · ${fmtDay(r.decision)} → ${fmtDay(r.buyoutStart)}`}</title>
            </rect>
            <rect
              x={x(r.buyoutStart)}
              y={yc - CHAIN_H / 2}
              width={Math.max(1, x(r.fabStart) - x(r.buyoutStart))}
              height={CHAIN_H}
              fill={SEG_COLORS.buyout}
            >
              <title>{`Buyout / award · ${fmtDay(r.buyoutStart)} → ${fmtDay(r.fabStart)}`}</title>
            </rect>
            <rect
              x={x(r.fabStart)}
              y={yc - CHAIN_H / 2}
              width={Math.max(1, x(r.start) - x(r.fabStart))}
              height={CHAIN_H}
              fill="#ffffff"
              stroke="#9aa09b"
              strokeWidth={1}
              strokeDasharray="3 2"
            >
              <title>{`Submittals / fabrication · ${fmtDay(r.fabStart)} → ${fmtDay(r.start)}`}</title>
            </rect>

            {/* Decision dot + date. */}
            <circle cx={x(r.decision)} cy={yc} r={4} fill={decisionColor}>
              <title>{`Owner decision / design release · ${fmtDay(r.decision)}${r.atRisk ? ' — AT RISK (past today)' : ''}`}</title>
            </circle>
            <text
              x={x(r.decision)}
              y={yc - 10}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={decisionColor}
            >
              {fmtMonthYr(r.decision)}
              {r.atRisk ? ' · at risk' : ''}
            </text>

            {/* Construction window band. */}
            <rect
              x={x(r.start)}
              y={yc - BAND_H / 2}
              width={Math.max(2, x(r.end) - x(r.start))}
              height={BAND_H}
              rx={2}
              fill={kindColor}
              fillOpacity={0.28}
              stroke={kindColor}
              strokeWidth={1}
            >
              <title>{`${r.name} · ${fmtDay(r.start)} → ${fmtDay(r.end)}`}</title>
            </rect>

            {/* Long-lead order-by diamonds (staggered when crowded). */}
            {rowMarks
              .slice()
              .sort((a, b) => a.orderBy.getTime() - b.orderBy.getTime())
              .map((m, mi) => {
                const mx = x(m.orderBy)
                const my = yc + 16 + (mi % 2) * 12
                const accent = m.atRisk ? ALERT : TRADE_ACCENT[m.trade]
                return (
                  <g key={m.key}>
                    <line x1={mx} y1={yc + CHAIN_H / 2} x2={mx} y2={my - 5} stroke={accent} strokeWidth={0.8} strokeOpacity={0.5} />
                    <Diamond cx={mx} cy={my} r={5} fill={accent} stroke="#ffffff" />
                    <title>{`Order by ${fmtDay(m.orderBy)} — ${m.label} (${m.weeks} wk lead, serves ${m.window})${m.atRisk ? ' — AT RISK' : ''}`}</title>
                    <text x={mx + 9} y={my + 3} fontSize={9} fontWeight={700} fill={accent}>
                      {TRADE_SHORT[m.trade]} · {fmtMonthYr(m.orderBy)}
                    </text>
                  </g>
                )
              })}
          </g>
        )
      })}

      {/* Today line. */}
      <line x1={todayX} y1={AXIS_H} x2={todayX} y2={H - 4} stroke={INK} strokeWidth={1.2} strokeDasharray="5 3" />
      <text x={todayX + 5} y={AXIS_H + 12} fontSize={10} fontWeight={700} fill={INK}>
        today
      </text>
    </svg>
  )
}
