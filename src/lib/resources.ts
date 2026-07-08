// Resources-tab parametric staffing engine. Every number here is a declared
// planning assumption exposed as an editable input in the UI — nothing is a
// fact. Trade-per-window spend REUSES computeTotals' CONT straight-line OS/DS
// split (phaseWithContinuous) by running it over each trade's item subset, so
// the distribution logic is never reimplemented.
import type { EscalationRates, Item, PhaseId, Trade } from '../types'
import {
  computeTotals,
  DURING_SEASON_MONTHS,
  OFFSEASON_MONTHS,
} from './escalation'
import { PHASE_BY_ID } from './phases'

// Weeks per month (52 / 12) — used to turn a window's month span into work hrs.
export const WEEKS_PER_MONTH = 4.333

// Field-labor fraction per trade (share of escalated cost that is field labor).
export const LABOR_FRACTION_DEFAULTS: Record<Trade, number> = {
  HVAC: 0.45,
  'Electrical & Low Voltage': 0.45,
  Plumbing: 0.45,
  'Fire Protection': 0.45,
  'Structural/Concrete Repair': 0.5,
  'Bowl & Rigging': 0.4,
  Sitework: 0.4,
  'Interior Buildout': 0.35,
  'Building Envelope': 0.35,
  'Acoustical & Specialties': 0.35,
  'Vertical Transportation': 0.3,
  Seating: 0.25,
  'Audio Visual': 0.2,
  'Food Service Equipment': 0.15,
  'Aging Assets (Owner Decision)': 0.35, // item is $0 → inert
}

export interface GlobalAssumptions {
  blendedRate: number // $/craft-hour, all-in
  peakFactor: number // peak = avg × this
  crewWeekHrs: number // scheduled field hours per week
  fieldStaffDivisor: number // site peak craft per PCL field staffer
  fieldStaffBase: number // base PCL field staff per window
}

export const GLOBAL_DEFAULTS: GlobalAssumptions = {
  blendedRate: 105,
  peakFactor: 1.5,
  crewWeekHrs: 40,
  fieldStaffDivisor: 15,
  fieldStaffBase: 3,
}

// Escalated spend per trade per phase window. Discrete items land in their
// assigned window; CONT items are split straight-line OS/DS — both handled by
// computeTotals, called once per trade subset.
export function tradeWindowSpend(
  items: Item[],
  rates: EscalationRates,
): Map<Trade, Record<PhaseId, number>> {
  const byTrade = new Map<Trade, Item[]>()
  for (const it of items) {
    const arr = byTrade.get(it.trade)
    if (arr) arr.push(it)
    else byTrade.set(it.trade, [it])
  }
  const out = new Map<Trade, Record<PhaseId, number>>()
  for (const [trade, subset] of byTrade) {
    out.set(trade, computeTotals(subset, rates).phaseWithContinuous)
  }
  return out
}

// Total field work hours a window offers: months × weeks/month × crew-week hrs.
export function windowHours(phase: PhaseId, crewWeekHrs: number): number {
  const months =
    PHASE_BY_ID[phase].kind === 'offseason'
      ? OFFSEASON_MONTHS
      : DURING_SEASON_MONTHS
  return months * WEEKS_PER_MONTH * crewWeekHrs
}

export interface CrewCell {
  avg: number // whole people
  peak: number // whole people
}

// Derive avg/peak craft for one trade in one window from its escalated spend.
export function crewCell(
  spend: number,
  laborFraction: number,
  phase: PhaseId,
  g: GlobalAssumptions,
): CrewCell {
  const laborDollars = spend * laborFraction
  const craftHours = g.blendedRate > 0 ? laborDollars / g.blendedRate : 0
  const wh = windowHours(phase, g.crewWeekHrs)
  const avgRaw = wh > 0 ? craftHours / wh : 0
  return { avg: Math.round(avgRaw), peak: Math.round(avgRaw * g.peakFactor) }
}
