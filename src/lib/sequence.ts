// Sequence-tab derivations: ring layout, wedge width resolution, window
// aggregation and shading. Pure functions over the live store items + rates —
// no cost/escalation logic is duplicated (per-window CONT folding mirrors
// computeTotals exactly, via the same exported month constants), so per-window
// totals reconcile to the escalated headline by construction.
import type { EscalationRates, Item, Trade } from '../types'
import {
  DURING_SEASON_MONTHS,
  escalatedCost,
  OFFSEASON_MONTHS,
  yearMultiplier,
} from './escalation'
import type { Totals } from './escalation'
import { PHASE_BY_ID } from './phases'
import {
  GEOMETRY_BY_ID,
  PLAN_ASPECT,
  PLAN_LEVELS,
  SEQUENCE_WINDOWS,
} from '../data/arenaGeometry'
import { color, ramp as tokenRamp, seq as seqTokens } from './tokens'
import type {
  ItemGeometry,
  PlanLevelId,
  SequenceWindow,
  WindowPhaseId,
} from '../data/arenaGeometry'

// ── Ring layout ────────────────────────────────────────────────────────────
// Ring thickness ∝ level's share of total discrete base cost, min-clamped so
// L700 (1.3% of base) stays clickable. Radii are normalized: 0 = plan center,
// 1 = outer edge of L700. The court disc occupies r < COURT_R.
export const COURT_R = 0.2
const MIN_SHARE = 0.07

export interface RingSpec {
  level: PlanLevelId
  inner: number
  outer: number
}

export function computeRings(items: Item[]): RingSpec[] {
  const baseByLevel: Record<string, number> = {}
  let total = 0
  for (const it of items) {
    if (!(PLAN_LEVELS as string[]).includes(it.level)) continue
    baseByLevel[it.level] = (baseByLevel[it.level] ?? 0) + it.base
    total += it.base
  }
  const weights = PLAN_LEVELS.map((lvl) =>
    Math.max(total > 0 ? (baseByLevel[lvl] ?? 0) / total : 1 / PLAN_LEVELS.length, MIN_SHARE),
  )
  const weightSum = weights.reduce((s, w) => s + w, 0)
  const usable = 1 - COURT_R
  let cursor = COURT_R
  return PLAN_LEVELS.map((level, i) => {
    const inner = cursor
    cursor += (weights[i] / weightSum) * usable
    return { level, inner, outer: cursor }
  })
}

// ── Wedge width resolution ─────────────────────────────────────────────────
// Widths are proportional to item SF within each ring (min 8° for
// clickability), except where the geometry spec fixes an explicit span.
// Neighboring wedges that would collide split the available gap
// proportionally to their widths (2° gutter), so crowded arcs (the north
// service end) compress gracefully instead of overlapping.
const MIN_WIDTH = 8
const MAX_WIDTH = 70
const MAX_SCALE = 0.005 // deg per SF cap — keeps sparse rings (L700) honest
const RING_BUDGET = 260 // target located degrees per ring before pair-fitting
const GUTTER = 2

export interface PlacedArc {
  start: number // degrees (0=N, cw); may extend past 360 when wrapping north
  end: number
}

export interface Placement {
  item: Item
  geo: ItemGeometry
  kind: 'wedge' | 'annular' | 'segments'
  arcs: PlacedArc[]
}

export interface LevelPlacements {
  level: PlanLevelId
  placed: Placement[] // annular first, then wedges, then segments (draw order)
  distributed: Item[] // rendered as a tint band filling the remaining arc
}

function norm360(a: number): number {
  return ((a % 360) + 360) % 360
}

export function resolvePlacements(items: Item[]): LevelPlacements[] {
  const byLevel = new Map<PlanLevelId, Item[]>()
  for (const it of items) {
    const geo = GEOMETRY_BY_ID[it.id]
    if (!geo) continue
    const arr = byLevel.get(geo.level)
    if (arr) arr.push(it)
    else byLevel.set(geo.level, [it])
  }

  return PLAN_LEVELS.map((level) => {
    const levelItems = byLevel.get(level) ?? []
    const distributed: Item[] = []
    const annular: Placement[] = []
    const segments: Placement[] = []
    // Proportional scale for this ring (wedges without explicit span + all
    // proportional segments share it).
    let propSf = 0
    for (const it of levelItems) {
      const g = GEOMETRY_BY_ID[it.id]
      if (g.shape.kind === 'wedge' && g.shape.span == null) propSf += it.qty
      if (g.shape.kind === 'segments' && g.shape.segmentSpan == null) propSf += it.qty
    }
    const scale = propSf > 0 ? Math.min(RING_BUDGET / propSf, MAX_SCALE) : 0

    // Wedges get pair-fitted; collect first.
    interface Fit {
      item: Item
      geo: ItemGeometry
      center: number
      half: number
      fixed: boolean
    }
    const fits: Fit[] = []

    for (const it of levelItems) {
      const geo = GEOMETRY_BY_ID[it.id]
      const shape = geo.shape
      if (shape.kind === 'distributed') {
        distributed.push(it)
      } else if (shape.kind === 'annular') {
        annular.push({ item: it, geo, kind: 'annular', arcs: [{ start: 0, end: 360 }] })
      } else if (shape.kind === 'segments') {
        const per =
          shape.segmentSpan ??
          Math.max(6, Math.min(MAX_WIDTH, it.qty * scale) / shape.centers.length)
        segments.push({
          item: it,
          geo,
          kind: 'segments',
          arcs: shape.centers.map((c) => ({ start: c - per / 2, end: c + per / 2 })),
        })
      } else {
        const width =
          shape.span ?? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, it.qty * scale))
        fits.push({
          item: it,
          geo,
          center: norm360(shape.angle),
          half: width / 2,
          fixed: shape.span != null,
        })
      }
    }

    // Pair-fit: two passes over cyclic neighbors, splitting tight gaps
    // proportionally to current half-widths.
    fits.sort((a, b) => a.center - b.center)
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < fits.length; i++) {
        const a = fits[i]
        const b = fits[(i + 1) % fits.length]
        if (a === b) continue
        const gap = i + 1 < fits.length ? b.center - a.center : b.center + 360 - a.center
        const room = gap - GUTTER
        const need = a.half + b.half
        if (need > room && need > 0) {
          const shrink = (h: number) => Math.max(MIN_WIDTH / 2, (h / need) * room)
          if (!a.fixed) a.half = shrink(a.half)
          if (!b.fixed) b.half = shrink(b.half)
        }
      }
    }

    // Widest first, so where a fixed-span wedge wraps behind neighbors (the
    // South Club across the baseline lobbies) the smaller wedges draw on top.
    const wedges: Placement[] = fits
      .slice()
      .sort((a, b) => b.half - a.half)
      .map((f) => ({
        item: f.item,
        geo: f.geo,
        kind: 'wedge' as const,
        arcs: [{ start: f.center - f.half, end: f.center + f.half }],
      }))

    return { level, placed: [...annular, ...wedges, ...segments], distributed }
  })
}

// ── Per-window spend (mirrors computeTotals' CONT straight-line folding) ───
// Discrete item: full escalated cost lands in its own window. CONT item: each
// alloc year's escalated portion splits 4/12 to that year's OS window and
// 8/12 to its DS window — identical math to escalation.ts, so summing this
// over all items per window reproduces totals.phaseWithContinuous exactly.
export function itemWindowSpend(
  item: Item,
  rates: EscalationRates,
  window: WindowPhaseId,
): number {
  if (!item.included) return 0
  if (item.phase === window) return escalatedCost(item, rates)
  if (item.phase !== 'CONT') return 0
  const def = PHASE_BY_ID[window]
  if (def.year === null) return 0
  const y = def.year as 2027 | 2028 | 2029
  const yearAmt = item.base * (item.alloc[y] / 100) * yearMultiplier(y, rates)
  const months = def.kind === 'offseason' ? OFFSEASON_MONTHS : DURING_SEASON_MONTHS
  return (yearAmt * months) / 12
}

// ── Window stats for the right panel ───────────────────────────────────────
export interface TradeSpend {
  trade: Trade
  amount: number
}

export interface WindowStats {
  window: SequenceWindow
  windowTotal: number // discrete + folded CONT (= totals.phaseWithContinuous)
  contInWindow: number // CONT slice of windowTotal
  cumulative: number // Σ windowTotal through this window — hits headline at 3DS
  pctComplete: number
  spacesCompleted: number // discrete included items in windows ≤ this one
  itemCount: number // discrete included items in this window
  topTrades: TradeSpend[] // top 3 by window spend, CONT folded in
}

export function windowIndex(phase: string): number {
  const w = SEQUENCE_WINDOWS.find((s) => s.phase === phase)
  return w ? w.index : Infinity // CONT → never "completed by window k"
}

export function computeWindowStats(
  items: Item[],
  rates: EscalationRates,
  totals: Totals,
  window: SequenceWindow,
): WindowStats {
  const windowTotal = totals.phaseWithContinuous[window.phase]
  const contInWindow = windowTotal - totals.phaseSubtotals[window.phase]
  let cumulative = 0
  for (const w of SEQUENCE_WINDOWS) {
    if (w.index <= window.index) cumulative += totals.phaseWithContinuous[w.phase]
  }

  let spacesCompleted = 0
  let itemCount = 0
  const byTrade = new Map<Trade, number>()
  for (const it of items) {
    if (!it.included) continue
    const isDiscrete = it.id in GEOMETRY_BY_ID
    if (isDiscrete && windowIndex(it.phase) <= window.index) spacesCompleted += 1
    if (isDiscrete && it.phase === window.phase) itemCount += 1
    const spend = itemWindowSpend(it, rates, window.phase)
    if (spend > 0) byTrade.set(it.trade, (byTrade.get(it.trade) ?? 0) + spend)
  }
  const topTrades = [...byTrade.entries()]
    .map(([trade, amount]) => ({ trade, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3)

  return {
    window,
    windowTotal,
    contInWindow,
    cumulative,
    pctComplete: totals.escalatedTotal > 0 ? cumulative / totals.escalatedTotal : 0,
    spacesCompleted,
    itemCount,
    topTrades,
  }
}

// ── Shading ────────────────────────────────────────────────────────────────
// Three-state language when a window is selected: prior windows flat neutral
// gray ("done"), the selected window ramps white → the intensity-ramp maximum
// by escalated spend (share of the window's largest discrete item), later
// windows near-white with a faint outline. No selection (ALL view) keeps
// every wedge white. All colors come from the design-token authority.
function hexToRgbTuple(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

const RAMP_MAX = hexToRgbTuple(tokenRamp[tokenRamp.length - 1])
const DONE_RAMP_TARGET = hexToRgbTuple(seqTokens.doneRampTarget)

function ramp(target: [number, number, number], t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const c = target.map((ch) => Math.round(255 + (ch - 255) * k))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

// Magnitude intensity: white → ramp maximum (the wedge/strip shading scale).
export function rampScale(t: number): string {
  return ramp(RAMP_MAX, t)
}

export function grayScale(t: number): string {
  return ramp(DONE_RAMP_TARGET, t)
}

// Flat "completed" wedge fill — no intensity ramp; done work all reads alike.
export const COMPLETED_GRAY = seqTokens.done
// Near-white "not yet" fill for future windows of the selected sequence.
export const FUTURE_FILL = seqTokens.future
const FUTURE_STROKE_OPACITY = seqTokens.futureStrokeOpacity

// Building Systems (continuous) accent — muted gold, clearly distinct from
// the intensity ramp. Used for the 2D halo band, the 3D spine prism and
// their captions.
export const SYSTEMS_GOLD = color.gold

export type ShadeState = 'excluded' | 'future' | 'completed' | 'active'

export interface ItemShade {
  state: ShadeState
  fill: string
  strokeOpacity: number // faded outlines for completed/future under a selection
  intensity: number // 0..1 — active items' spend share of the window max
  spend: number // escalated $ in the selected window (active items)
}

export function computeShades(
  items: Item[],
  rates: EscalationRates,
  selected: SequenceWindow | null,
): Map<string, ItemShade> {
  const shades = new Map<string, ItemShade>()
  // Max discrete spend in the selected window (scales active intensity).
  let maxSpend = 0
  if (selected) {
    for (const it of items) {
      if (!(it.id in GEOMETRY_BY_ID)) continue
      const s = itemWindowSpend(it, rates, selected.phase)
      if (s > maxSpend) maxSpend = s
    }
  }
  for (const it of items) {
    if (!(it.id in GEOMETRY_BY_ID)) continue
    if (!it.included) {
      shades.set(it.id, { state: 'excluded', fill: seqTokens.excluded, strokeOpacity: 1, intensity: 0, spend: 0 })
      continue
    }
    if (!selected) {
      shades.set(it.id, { state: 'future', fill: color.surface, strokeOpacity: 1, intensity: 0, spend: 0 })
      continue
    }
    const spend = itemWindowSpend(it, rates, selected.phase)
    if (spend > 0) {
      const share = maxSpend > 0 ? spend / maxSpend : 1
      const t = 0.45 + 0.55 * share
      shades.set(it.id, { state: 'active', fill: rampScale(t), strokeOpacity: 1, intensity: share, spend })
    } else if (windowIndex(it.phase) < selected.index) {
      shades.set(it.id, { state: 'completed', fill: COMPLETED_GRAY, strokeOpacity: 0.55, intensity: 0, spend: 0 })
    } else {
      shades.set(it.id, { state: 'future', fill: FUTURE_FILL, strokeOpacity: FUTURE_STROKE_OPACITY, intensity: 0, spend: 0 })
    }
  }
  return shades
}

// Mini-strip cell fill under the same three-state language: past windows keep
// their intensity but in gray, the selected window keeps the intensity ramp,
// future windows fade to a faint hint. No selection → all-windows ramped.
export function stripCellFill(v: number, wi: number, selectedIdx: number | null): string {
  const t = 0.06 + 0.9 * v
  if (selectedIdx === null || wi === selectedIdx) return rampScale(t)
  if (wi < selectedIdx) return grayScale(t)
  return rampScale(t * 0.22)
}

// CONT wash intensity per window: that window's folded CONT spend relative to
// the largest window's. Returns 0..1 per window phase.
export function contWashByWindow(totals: Totals): Record<WindowPhaseId, number> {
  const conts = SEQUENCE_WINDOWS.map(
    (w) => totals.phaseWithContinuous[w.phase] - totals.phaseSubtotals[w.phase],
  )
  const max = Math.max(...conts, 0)
  const out = {} as Record<WindowPhaseId, number>
  SEQUENCE_WINDOWS.forEach((w, i) => {
    out[w.phase] = max > 0 ? conts[i] / max : 0
  })
  return out
}

// ── Level × window intensity matrix (six-cell mini strips) ─────────────────
// Cell = level's discrete escalated spend in that window, normalized by the
// global max cell so strips are comparable across levels.
export function levelWindowMatrix(
  items: Item[],
  rates: EscalationRates,
): Record<PlanLevelId, number[]> {
  const raw = {} as Record<PlanLevelId, number[]>
  for (const lvl of PLAN_LEVELS) raw[lvl] = SEQUENCE_WINDOWS.map(() => 0)
  for (const it of items) {
    const geo = GEOMETRY_BY_ID[it.id]
    if (!geo || !it.included) continue
    SEQUENCE_WINDOWS.forEach((w, i) => {
      if (it.phase === w.phase) raw[geo.level][i] += escalatedCost(it, rates)
    })
  }
  let max = 0
  for (const lvl of PLAN_LEVELS) for (const v of raw[lvl]) if (v > max) max = v
  if (max > 0) {
    for (const lvl of PLAN_LEVELS) {
      raw[lvl] = raw[lvl].map((v) => v / max)
    }
  }
  return raw
}

// ── Plan → screen path math (shared by both views) ─────────────────────────
// Plan space: unit-circle radius with the 1.25:1 ellipse aspect applied
// (x ∈ [-1, 1], y ∈ [-1/1.25, 1/1.25]); 0° = north (−y), clockwise.
// Views supply a ProjectFn: 2D plan = uniform scale + translate; 3D stack =
// (x·1.0, y·0.45 − z) — an axis-aligned squash, so wedge arcs sampled here
// become true elliptical arcs under the transform.
export type ProjectFn = (x: number, y: number) => readonly [number, number]

export function planXY(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180
  return [Math.sin(a) * r, (-Math.cos(a) * r) / PLAN_ASPECT]
}

const ARC_STEP = 4 // degrees per sample

function arcPoints(a0: number, a1: number, r: number): [number, number][] {
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / ARC_STEP))
  const pts: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    pts.push(planXY(a0 + ((a1 - a0) * i) / n, r))
  }
  return pts
}

// Closed wedge between two radii and two angles.
export function wedgePath(
  a0: number,
  a1: number,
  r0: number,
  r1: number,
  project: ProjectFn,
): string {
  const outer = arcPoints(a0, a1, r1).map(([x, y]) => project(x, y))
  const inner = arcPoints(a1, a0, r0).map(([x, y]) => project(x, y))
  const d = [...outer, ...inner]
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  return `${d} Z`
}

// Full annular band (two concentric ellipses, evenodd fill).
export function annulusPath(r0: number, r1: number, project: ProjectFn): string {
  const ring = (r: number) =>
    arcPoints(0, 360, r)
      .map(([x, y]) => project(x, y))
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ') + ' Z'
  return `${ring(r1)} ${ring(r0)}`
}

// Full ellipse outline at radius r.
export function ellipsePath(r: number, project: ProjectFn): string {
  return (
    arcPoints(0, 360, r)
      .map(([x, y]) => project(x, y))
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ') + ' Z'
  )
}

// Centroid of a wedge (label/marker anchor).
export function wedgeCentroid(
  a0: number,
  a1: number,
  r0: number,
  r1: number,
  project: ProjectFn,
): readonly [number, number] {
  const [x, y] = planXY((a0 + a1) / 2, (r0 + r1) / 2)
  return project(x, y)
}

// Radial band each ring reserves for its wedges (a small inset keeps ring
// outlines readable). L100 wedges radiate from the court edge but start
// outside the Courtside Club annular band.
export const COURTSIDE_BAND = 0.22 // fraction of L100 ring depth
export function wedgeRadii(ring: RingSpec): [number, number] {
  const depth = ring.outer - ring.inner
  const inset = depth * 0.06
  if (ring.level === 'L100') {
    return [ring.inner + depth * COURTSIDE_BAND + inset, ring.outer - inset]
  }
  return [ring.inner + inset, ring.outer - inset]
}
