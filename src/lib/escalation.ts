import type {
  ContAllocation,
  ContYear,
  EscalationRates,
  Item,
  PhaseId,
  Year,
} from '../types'
import { CONT_YEARS, PHASE_BY_ID } from './phases'

// Straight-line (per-month) distribution of continuous spend into windows.
// Within a calendar year the offseason window is Jun 1–Sep 30 (4 months); the
// during-season window is Oct 1–May 31, which inside a single calendar year
// captures Jan–May + Oct–Dec (8 months). Together they cover all 12 months, so
// a year's continuous amount splits 4/12 to its OS window and 8/12 to its DS
// window — the 8-month DS window absorbs twice the OS window. Each CONT year
// maps to its same-numbered OS/DS pair (matches the year labels in phases.ts).
// Exported so downstream parametric views (Resources crew-hour windows) size
// their month spans from the same source as the CONT straight-line split.
export const OFFSEASON_MONTHS = 4
export const DURING_SEASON_MONTHS = 8
const MONTHS_PER_YEAR = 12

// Season window month boundaries (calendar month, 1 = Jan … 12 = Dec), lifted
// out of the distribution comment above so downstream views (the analytics
// cash-flow S-curve) get month-accurate band edges. Offseason runs Jun 1 – Sep
// 30; during-season runs Oct 1 – May 31, wrapping into the following year.
export const SEASON_WINDOWS = {
  offseason: { startMonth: 6, endMonth: 9 }, // Jun 1 – Sep 30 (4 months)
  duringSeason: { startMonth: 10, endMonth: 5 }, // Oct 1 – May 31 (8 months)
} as const
const CONT_YEAR_WINDOWS: Record<ContYear, { os: PhaseId; ds: PhaseId }> = {
  2027: { os: '1OS', ds: '1DS' },
  2028: { os: '2OS', ds: '2DS' },
  2029: { os: '3OS', ds: '3DS' },
}

// Compounding multiplier from base year 2025 to the end of `year`.
//   multiplier(Y) = product of (1 + rate_y) for y in 2026..Y
// e.g. flat 5%: 2027 -> 1.05^2 = 1.1025, 2029 -> 1.05^4 = 1.21550625
export function yearMultiplier(year: Year, rates: EscalationRates): number {
  let m = 1
  for (let y = 2026 as Year; y <= year; y = (y + 1) as Year) {
    m *= 1 + rates[y]
  }
  return m
}

// CONT items: base spread across 2027/2028/2029 per the item's own allocation
// (percents summing to 100). Each year's portion escalates to that year, so the
// effective multiplier is the allocation-weighted average of the year mults.
export function contMultiplier(
  alloc: ContAllocation,
  rates: EscalationRates,
): number {
  return CONT_YEARS.reduce(
    (acc, y) => acc + (alloc[y] / 100) * yearMultiplier(y, rates),
    0,
  )
}

// Effective escalation multiplier for an item given its phase.
export function itemMultiplier(item: Item, rates: EscalationRates): number {
  const def = PHASE_BY_ID[item.phase]
  if (def.year === null) return contMultiplier(item.alloc, rates)
  return yearMultiplier(def.year, rates)
}

// escalatedCost(item) = base x multiplier(phase year). Excluded items = 0.
export function escalatedCost(item: Item, rates: EscalationRates): number {
  if (!item.included) return 0
  return item.base * itemMultiplier(item, rates)
}

export interface Totals {
  baseTotal: number // included base (2025 dollars)
  escalatedTotal: number // included, escalated
  includedCount: number
  totalCount: number
  // escalated spend landing in each calendar year (CONT split across thirds)
  spendByYear: Record<Year, number>
  // escalated discrete-scope subtotal per time-window phase (CONT excluded)
  phaseSubtotals: Record<PhaseId, number>
  // total escalated cost of all continuous (CONT) items — spread across phases
  continuousTotal: number
  // discrete subtotal + straight-line continuous spend folded into each of the
  // 6 time windows (CONT key unused). The 6 entries sum to escalatedTotal.
  phaseWithContinuous: Record<PhaseId, number>
}

export function computeTotals(items: Item[], rates: EscalationRates): Totals {
  let baseTotal = 0
  let escalatedTotal = 0
  let includedCount = 0
  let continuousTotal = 0
  const spendByYear: Record<Year, number> = { 2026: 0, 2027: 0, 2028: 0, 2029: 0 }
  const phaseSubtotals: Record<PhaseId, number> = {
    '1OS': 0,
    '1DS': 0,
    '2OS': 0,
    '2DS': 0,
    '3OS': 0,
    '3DS': 0,
    CONT: 0,
  }
  const phaseWithContinuous: Record<PhaseId, number> = {
    '1OS': 0,
    '1DS': 0,
    '2OS': 0,
    '2DS': 0,
    '3OS': 0,
    '3DS': 0,
    CONT: 0,
  }

  for (const item of items) {
    if (!item.included) continue
    includedCount += 1
    baseTotal += item.base
    const esc = escalatedCost(item, rates)
    escalatedTotal += esc
    phaseSubtotals[item.phase] += esc

    const def = PHASE_BY_ID[item.phase]
    if (def.year === null) {
      // CONT — each year's allocated portion lands in that year, escalated,
      // then spreads straight-line into that year's OS (4mo) / DS (8mo) windows.
      continuousTotal += esc
      for (const y of CONT_YEARS) {
        const yearAmt = item.base * (item.alloc[y] / 100) * yearMultiplier(y, rates)
        spendByYear[y] += yearAmt
        const w = CONT_YEAR_WINDOWS[y]
        phaseWithContinuous[w.os] += (yearAmt * OFFSEASON_MONTHS) / MONTHS_PER_YEAR
        phaseWithContinuous[w.ds] += (yearAmt * DURING_SEASON_MONTHS) / MONTHS_PER_YEAR
      }
    } else {
      spendByYear[def.year] += esc
      phaseWithContinuous[item.phase] += esc
    }
  }

  return {
    baseTotal,
    escalatedTotal,
    includedCount,
    totalCount: items.length,
    spendByYear,
    phaseSubtotals,
    continuousTotal,
    phaseWithContinuous,
  }
}
