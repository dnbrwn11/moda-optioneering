// Analytics-tab derivations. All functions read the already-computed `Totals`
// (or re-run computeTotals for sensitivity) — no cost/escalation logic is
// duplicated or changed here, only arithmetic on existing outputs.
import type { EscalationRates, Item, PhaseId, Year } from '../types'
import { computeTotals, SEASON_WINDOWS } from './escalation'
import type { Totals } from './escalation'
import { TIME_PHASES } from './phases'
import { kindContinuous, win } from './tokens'

// Categorical series colors — from the design-token authority. The OS/DS
// window pair also carries a border shade (KIND_BORDERS) for light-tint fills.
export const KIND_COLORS = {
  offseason: win.os.fill,
  'during-season': win.ds.fill,
  continuous: kindContinuous,
} as const

export const KIND_BORDERS = {
  offseason: win.os.border,
  'during-season': win.ds.border,
} as const

export const KIND_LABELS = {
  offseason: 'Offseason',
  'during-season': 'During-Season',
  continuous: 'Continuous / Systems',
} as const

export type SeriesKey = 'offseason' | 'during-season' | 'continuous'

export const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'during-season', label: KIND_LABELS['during-season'], color: KIND_COLORS['during-season'] },
  { key: 'offseason', label: KIND_LABELS.offseason, color: KIND_COLORS.offseason },
  { key: 'continuous', label: KIND_LABELS.continuous, color: KIND_COLORS.continuous },
]

export const SPEND_YEARS: Year[] = [2027, 2028, 2029]

// --- Spend by window (chronological 1OS→3DS) -----------------------------
// Escalated total landing in each of the six time windows (continuous folded in
// straight-line). The six amounts sum to escalatedTotal.
export interface WindowSpend {
  id: PhaseId
  label: string
  kind: 'offseason' | 'during-season'
  amount: number
}

export function spendByWindow(t: Totals): WindowSpend[] {
  return TIME_PHASES.map((p) => ({
    id: p.id,
    label: p.short,
    kind: p.kind as 'offseason' | 'during-season',
    amount: t.phaseWithContinuous[p.id],
  }))
}

// --- Stat strip ----------------------------------------------------------
// Share of the program landing in during-season windows (Oct 1 – May 31),
// using the straight-line calendar distribution (continuous folded in).
export function duringSeasonShare(t: Totals): number {
  if (t.escalatedTotal <= 0) return 0
  const ds = t.phaseWithContinuous['1DS'] + t.phaseWithContinuous['2DS'] + t.phaseWithContinuous['3DS']
  return ds / t.escalatedTotal
}

export function peakYear(t: Totals): { year: Year; amount: number } {
  return SPEND_YEARS.map((y) => ({ year: y, amount: t.spendByYear[y] })).reduce(
    (best, cur) => (cur.amount > best.amount ? cur : best),
  )
}

// --- Stacked bar: spend per year by kind (CONT as its own segment) -------
// Derived purely from existing Totals fields:
//   offseason/during-season = discrete phase subtotals (CONT excluded);
//   continuous = spendByYear minus that year's two discrete window subtotals.
export interface YearStack {
  year: Year
  label: string
  offseason: number
  'during-season': number
  continuous: number
}

export function spendByYearByKind(t: Totals): YearStack[] {
  return SPEND_YEARS.map((y) => {
    const n = y - 2026 // 1, 2, 3 → matches phase id prefixes
    const os = t.phaseSubtotals[`${n}OS` as PhaseId]
    const ds = t.phaseSubtotals[`${n}DS` as PhaseId]
    const continuous = Math.max(t.spendByYear[y] - os - ds, 0)
    return {
      year: y,
      label: String(y),
      offseason: os,
      'during-season': ds,
      continuous,
    }
  })
}

// --- Cumulative cash-flow S-curve ---------------------------------------
// The six time windows fall in chronological order (1OS, 1DS, 2OS, … 3DS).
// Offseason windows are 4 months (Jun–Sep); during-season windows are 8 months
// (Oct–May of the next year). Program clock starts Jun 2027. Window lengths and
// the start month are driven by SEASON_WINDOWS so band edges are month-accurate.
const OS_LEN =
  SEASON_WINDOWS.offseason.endMonth - SEASON_WINDOWS.offseason.startMonth + 1 // 4
const DS_LEN = 12 - OS_LEN // 8 — during-season fills the rest of the year
const PROGRAM_START_MONTH = SEASON_WINDOWS.offseason.startMonth // Jun (6)
const PROGRAM_START_YEAR = 2027

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Absolute month index (0 = program start) → "MMM YYYY" tick label.
export function monthLabel(index: number): string {
  const abs = PROGRAM_START_MONTH - 1 + index // 0-based month-of-epoch from Jan of start year
  const year = PROGRAM_START_YEAR + Math.floor(abs / 12)
  return `${MONTHS[((abs % 12) + 12) % 12]} ${year}`
}

export interface CashBand {
  kind: 'offseason' | 'during-season'
  start: number
  end: number
}

export interface CashFlow {
  points: { t: number; cum: number }[]
  bands: CashBand[]
  total: number
  ticks: number[]
}

export function cashFlowCurve(t: Totals): CashFlow {
  const windows = TIME_PHASES.map((p) => ({
    kind: p.kind as 'offseason' | 'during-season',
    amount: t.phaseWithContinuous[p.id],
    len: p.kind === 'offseason' ? OS_LEN : DS_LEN,
  }))

  const points: { t: number; cum: number }[] = [{ t: 0, cum: 0 }]
  const bands: CashBand[] = []
  const ticks: number[] = [0]
  let cursor = 0
  let cum = 0

  for (const w of windows) {
    const perMonth = w.len > 0 ? w.amount / w.len : 0
    const start = cursor
    for (let m = 0; m < w.len; m++) {
      cum += perMonth
      cursor += 1
      points.push({ t: cursor, cum })
    }
    bands.push({ kind: w.kind, start, end: cursor })
    ticks.push(cursor)
  }

  return { points, bands, total: cum, ticks }
}

// --- Escalation sensitivity ---------------------------------------------
// Program total recomputed at a flat annual rate applied to every year.
export function flatRates(rate: number): EscalationRates {
  return { 2026: rate, 2027: rate, 2028: rate, 2029: rate }
}

export const SENSITIVITY_RATES = [0, 0.025, 0.05, 0.075]

export interface SensitivityPoint {
  rate: number // fractional (0.05)
  ratePct: number // 5
  total: number
}

export function sensitivityCurve(items: Item[]): SensitivityPoint[] {
  return SENSITIVITY_RATES.map((rate) => ({
    rate,
    ratePct: rate * 100,
    total: computeTotals(items, flatRates(rate)).escalatedTotal,
  }))
}

// Average program cost added per +1%/yr of escalation across the plotted range.
export function premiumPerPoint(curve: SensitivityPoint[]): number {
  const lo = curve[0]
  const hi = curve[curve.length - 1]
  const spanPct = hi.ratePct - lo.ratePct
  if (spanPct <= 0) return 0
  return (hi.total - lo.total) / spanPct
}

// Mean of the current per-year rates — used to place the "current" marker on
// the sensitivity rate axis.
export function averageRatePct(rates: EscalationRates): number {
  const ys: Year[] = [2026, 2027, 2028, 2029]
  return (ys.reduce((s, y) => s + rates[y], 0) / ys.length) * 100
}
