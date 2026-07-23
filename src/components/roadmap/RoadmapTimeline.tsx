// Owner-decision timeline — clean SVG (recharts can't draw Gantt chains).
// One row per construction window: back-cast chain (decision dot → design →
// buyout → fabrication segments) flowing into the window band, long-lead
// order-by diamonds on their serving window's row, and a dashed "today" line.
// Past-due dates render in the alert color with the at-risk treatment.
//
// Label policy (rendering only — no date math here): diamonds are hover-first
// (FloatingTooltip card), packed into per-row mini-lanes so they never
// overlap; only at-risk markers keep a static label, lane-packed with their
// text width so those never collide either. Rows with more than MAX_VISIBLE
// markers collapse the healthy ones behind a hover/click badge. Decision-date
// labels sit statically left of the chain start.
import { useState } from 'react'
import { KIND_COLORS } from '../../lib/analytics'
import { fmtMillions } from '../../lib/format'
import { TRADE_ACCENT, TRADE_SHORT, tradeChipStyle } from '../../lib/trades'
import {
  AXIS_END,
  AXIS_START,
  fmtDay,
  fmtMonthYr,
} from '../../lib/roadmap'
import type { LongLeadMark, WindowRow } from '../../lib/roadmap'
import type { WindowPhaseId } from '../../data/arenaGeometry'
import { FloatingTooltip } from '../sequence/SequenceTooltip'
import type { TipState } from '../sequence/SequenceTooltip'
import { color as C, seq as SEQ } from '../../lib/tokens'

const W = 1440
const GUTTER = 128 // left row-label gutter
const PAD_R = 20
const AXIS_H = 30 // tick labels row at top
const BASE_PITCH = 50 // row pitch with ≤2 marker lanes
const ROW0 = AXIS_H + 26
const CHAIN_H = 8
const BAND_H = 18
const LANE0_DY = 16 // first marker lane below the row centerline
const LANE_H = 12
const MAX_VISIBLE = 4 // more markers than this → collapse healthy ones
const CLUSTER_GAP = 12 // min horizontal separation (~10px) before stacking
const ALERT = C.alert
const INK = C.ink

const SEG_COLORS = {
  design: SEQ.structure.slab,
  buyout: SEQ.structure.buyout,
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

// Rough text width in viewBox units (Barlow at fontSize 9) — used only for
// lane packing / badge sizing, so a small over-estimate is fine.
function estText(s: string): number {
  return s.length * 4.8
}

// ── Per-row marker layout ──────────────────────────────────────────────────

interface PlacedMark {
  mark: LongLeadMark
  mx: number
  lane: number
}

interface RowLayout {
  placed: PlacedMark[] // rendered markers with assigned lanes
  hidden: LongLeadMark[] // healthy markers behind the collapse badge
  badge: { bx: number; lane: number; label: string } | null
  // Lane claimed by a near-today decision label (it joins the packing so
  // markers/badge can never sit on top of it); null → label at dot level.
  decisionLane: number | null
  lanes: number // lane count (drives this row's pitch)
}

// Greedy lane packing: markers sorted by x each take the first lane whose
// last occupant ends before them; at-risk markers reserve their static-label
// width so labels can never collide. A collapsed row hides its healthy
// markers behind one badge (at-risk markers always render — they must be
// legible without interaction).
function layoutRow(
  rowMarks: LongLeadMark[],
  isExpanded: boolean,
  decisionReserveEnd: number | null,
): RowLayout {
  const sorted = rowMarks.slice().sort((a, b) => a.orderBy.getTime() - b.orderBy.getTime())
  const collapsed = sorted.length > MAX_VISIBLE && !isExpanded
  const rendered = collapsed ? sorted.filter((m) => m.atRisk) : sorted
  const hidden = collapsed ? sorted.filter((m) => !m.atRisk) : []

  const laneNextFree: number[] = []
  // Near-today decision label claims lane 0 first, ahead of everything else.
  let decisionLane: number | null = null
  if (decisionReserveEnd !== null) {
    decisionLane = 0
    laneNextFree.push(decisionReserveEnd)
  }
  const placed: PlacedMark[] = rendered.map((mark) => {
    const mx = x(mark.orderBy)
    const width = mark.atRisk
      ? CLUSTER_GAP + estText(`${mark.label} · ${fmtDay(mark.orderBy)}`)
      : CLUSTER_GAP
    let lane = laneNextFree.findIndex((free) => mx - CLUSTER_GAP / 2 >= free)
    if (lane === -1) {
      lane = laneNextFree.length
      laneNextFree.push(0)
    }
    laneNextFree[lane] = mx - CLUSTER_GAP / 2 + width
    return { mark, mx, lane }
  })

  let badge: RowLayout['badge'] = null
  if (collapsed && hidden.length > 0) {
    const xs = hidden.map((m) => x(m.orderBy))
    const label = `${hidden.length} long-lead orders — hover`
    const half = (estText(label) + 16) / 2
    const bx = Math.min(W - PAD_R - half, Math.max(GUTTER + half, (Math.min(...xs) + Math.max(...xs)) / 2))
    badge = { bx, lane: laneNextFree.length === 0 ? 0 : laneNextFree.length, label }
  } else if (isExpanded && sorted.length > MAX_VISIBLE) {
    const xs = sorted.map((m) => x(m.orderBy))
    const bx = Math.min(W - PAD_R - 30, Math.max(GUTTER + 30, (Math.min(...xs) + Math.max(...xs)) / 2))
    badge = { bx, lane: laneNextFree.length, label: 'collapse' }
  }

  const lanes = Math.max(laneNextFree.length, badge ? badge.lane + 1 : 0)
  return { placed, hidden, badge, decisionLane, lanes }
}

// ── Tooltip content ────────────────────────────────────────────────────────

function TipRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-ink-muted">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  )
}

function MarkTip({ mark, rowLabel }: { mark: LongLeadMark; rowLabel: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-bold leading-tight">{mark.label}</span>
      <span className="flex flex-wrap items-center gap-1">
        <span className="rounded border px-1 py-px text-[10px] font-bold" style={tradeChipStyle(mark.trade)}>
          {TRADE_SHORT[mark.trade]}
        </span>
      </span>
      <div className="flex flex-col gap-0.5 border-t pt-1.5" style={{ borderColor: C.gridline }}>
        <TipRow label="Order by" value={fmtDay(mark.orderBy)} />
        <TipRow label="Driving lead time" value={`${mark.weeks} wk`} />
        <TipRow label="Serves" value={rowLabel} />
      </div>
      {mark.atRisk && (
        <span className="text-[11px] font-bold" style={{ color: ALERT }}>
          AT RISK — order date is past today
        </span>
      )}
    </div>
  )
}

function BadgeTip({ marks, rowLabel }: { marks: LongLeadMark[]; rowLabel: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-bold leading-tight">Long-lead orders · {rowLabel}</span>
      <div className="flex flex-col gap-1 border-t pt-1.5" style={{ borderColor: C.gridline }}>
        {marks.map((m) => (
          <div key={m.key} className="flex items-baseline justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rotate-45"
                style={{ backgroundColor: m.atRisk ? ALERT : TRADE_ACCENT[m.trade] }}
                aria-hidden
              />
              <span className="text-ink">{m.label}</span>
            </span>
            <span className="whitespace-nowrap font-bold tabular-nums">
              {fmtDay(m.orderBy)} · {m.weeks} wk
            </span>
          </div>
        ))}
      </div>
      <span className="text-[10px] font-light italic text-ink-muted">click to expand lanes</span>
    </div>
  )
}

export interface RoadmapTimelineProps {
  rows: WindowRow[]
  marks: LongLeadMark[]
  today: Date
  moneyByPhase: Record<WindowPhaseId, number>
}

export default function RoadmapTimeline({ rows, marks, today, moneyByPhase }: RoadmapTimelineProps) {
  const ticks = axisTicks()
  const todayX = x(today)
  const [tip, setTip] = useState<TipState | null>(null)
  const [expanded, setExpanded] = useState<Set<WindowPhaseId>>(new Set())

  const onHover = (content: React.ReactNode | null, e?: React.MouseEvent) => {
    if (content && e) setTip({ content, x: e.clientX, y: e.clientY })
    else setTip(null)
  }
  const toggleExpanded = (phase: WindowPhaseId) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(phase)) next.delete(phase)
      else next.add(phase)
      return next
    })
    setTip(null)
  }

  const marksByRow = new Map<WindowPhaseId, LongLeadMark[]>()
  for (const m of marks) {
    const arr = marksByRow.get(m.window)
    if (arr) arr.push(m)
    else marksByRow.set(m.window, [m])
  }

  // Per-row layouts + variable pitch: rows with extra marker lanes grow so
  // lanes never bleed into the next row. Decision labels near the today line
  // drop into the lane system (reserved slot) instead of the dot level.
  const layouts = rows.map((r) => {
    const nearToday = Math.abs(x(r.decision) - todayX) < 70
    return layoutRow(
      marksByRow.get(r.phase) ?? [],
      expanded.has(r.phase),
      nearToday ? x(r.decision) - 4 : null,
    )
  })
  const rowYs: number[] = []
  let cursor = ROW0
  for (const l of layouts) {
    rowYs.push(cursor)
    cursor += BASE_PITCH + Math.max(0, l.lanes - 2) * LANE_H
  }
  const H = cursor + 8

  return (
    <>
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
            <line x1={tx} y1={AXIS_H} x2={tx} y2={H - 4} stroke={C.gridline} strokeWidth={1} />
            <text
              x={tx}
              y={AXIS_H - 8}
              textAnchor="middle"
              fontSize={11}
              fontWeight={isJan ? 700 : 400}
              fill={isJan ? INK : C.inkMuted}
            >
              {fmtMonthYr(t)}
            </text>
          </g>
        )
      })}

      {/* Window rows. */}
      {rows.map((r, i) => {
        const yc = rowYs[i]
        const layout = layouts[i]
        const kindColor = KIND_COLORS[r.kind]
        const decisionColor = r.atRisk ? ALERT : INK
        const rowLabel = `${r.short} · ${r.name}`
        const laneY = (lane: number) => yc + LANE0_DY + lane * LANE_H
        // Dot level normally; a reserved lane slot when near the today line.
        const decisionLabelY =
          layout.decisionLane !== null ? laneY(layout.decisionLane) + 3 : yc + 3
        return (
          <g key={r.phase}>
            {/* Row label: window short + escalated $ context. */}
            <text x={12} y={yc - 2} fontSize={12} fontWeight={700} fill={INK}>
              {r.short}
            </text>
            <text x={12} y={yc + 12} fontSize={11} fill={C.inkMuted} className="tabular-nums">
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
              stroke={SEQ.structure.drawn}
              strokeWidth={1}
              strokeDasharray="3 2"
            >
              <title>{`Submittals / fabrication · ${fmtDay(r.fabStart)} → ${fmtDay(r.start)}`}</title>
            </rect>

            {/* Decision dot + static date label, left of the chain start. */}
            <circle cx={x(r.decision)} cy={yc} r={4} fill={decisionColor}>
              <title>{`Owner decision / design release · ${fmtDay(r.decision)}${r.atRisk ? ' — AT RISK (past today)' : ''}`}</title>
            </circle>
            <text
              x={x(r.decision) - 8}
              y={decisionLabelY}
              textAnchor="end"
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

            {/* Long-lead order-by diamonds — lane-packed, hover for detail;
                only at-risk markers carry a static label. */}
            {layout.placed.map(({ mark: m, mx, lane }) => {
              const my = laneY(lane)
              const accent = m.atRisk ? ALERT : TRADE_ACCENT[m.trade]
              return (
                <g key={m.key}>
                  <line x1={mx} y1={yc + CHAIN_H / 2} x2={mx} y2={my - 5} stroke={accent} strokeWidth={0.8} strokeOpacity={0.5} />
                  <Diamond cx={mx} cy={my} r={5} fill={accent} stroke="#ffffff" />
                  {m.atRisk && (
                    <text x={mx + 9} y={my + 3} fontSize={9} fontWeight={700} fill={ALERT}>
                      {m.label} · {fmtDay(m.orderBy)}
                    </text>
                  )}
                  <circle
                    cx={mx}
                    cy={my}
                    r={10}
                    fill="transparent"
                    pointerEvents="all"
                    onMouseEnter={(e) => onHover(<MarkTip mark={m} rowLabel={rowLabel} />, e)}
                    onMouseLeave={() => onHover(null)}
                  />
                </g>
              )
            })}

            {/* Density fallback: collapsed healthy markers behind one badge
                (hover lists them; click expands the lanes). */}
            {layout.badge && (
              <g
                className="cursor-pointer"
                onClick={() => toggleExpanded(r.phase)}
                onMouseEnter={(e) =>
                  onHover(
                    layout.hidden.length > 0 ? (
                      <BadgeTip marks={layout.hidden} rowLabel={rowLabel} />
                    ) : null,
                    e,
                  )
                }
                onMouseLeave={() => onHover(null)}
              >
                <rect
                  x={layout.badge.bx - (estText(layout.badge.label) + 16) / 2}
                  y={laneY(layout.badge.lane) - 7}
                  width={estText(layout.badge.label) + 16}
                  height={14}
                  rx={7}
                  fill={C.trackBg}
                  stroke={C.line}
                  strokeWidth={1}
                />
                <text
                  x={layout.badge.bx}
                  y={laneY(layout.badge.lane) + 3}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill={INK}
                >
                  {layout.badge.label}
                </text>
              </g>
            )}
          </g>
        )
      })}

      {/* Today line. */}
      <line x1={todayX} y1={AXIS_H} x2={todayX} y2={H - 4} stroke={INK} strokeWidth={1.2} strokeDasharray="5 3" />
      <text x={todayX + 5} y={AXIS_H + 12} fontSize={10} fontWeight={700} fill={INK}>
        today
      </text>
    </svg>
    <FloatingTooltip tip={tip} />
    </>
  )
}
