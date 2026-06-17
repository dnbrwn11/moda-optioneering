import type { EscalationRates, Item, Year } from '../types'
import { CONT_YEARS, PHASE_BY_ID } from './phases'

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

// CONT items: base split evenly across 2027/2028/2029, each third escalated
// to its own year. Effective multiplier is the average of the three.
export function contMultiplier(rates: EscalationRates): number {
  const sum = CONT_YEARS.reduce((acc, y) => acc + yearMultiplier(y, rates), 0)
  return sum / CONT_YEARS.length
}

// Effective escalation multiplier for an item given its phase.
export function itemMultiplier(item: Item, rates: EscalationRates): number {
  const def = PHASE_BY_ID[item.phase]
  if (def.year === null) return contMultiplier(rates)
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
}

export function computeTotals(items: Item[], rates: EscalationRates): Totals {
  let baseTotal = 0
  let escalatedTotal = 0
  let includedCount = 0
  const spendByYear: Record<Year, number> = { 2026: 0, 2027: 0, 2028: 0, 2029: 0 }

  for (const item of items) {
    if (!item.included) continue
    includedCount += 1
    baseTotal += item.base
    const esc = escalatedCost(item, rates)
    escalatedTotal += esc

    const def = PHASE_BY_ID[item.phase]
    if (def.year === null) {
      // CONT — one escalated third lands in each of 2027/28/29
      const third = item.base / CONT_YEARS.length
      for (const y of CONT_YEARS) {
        spendByYear[y] += third * yearMultiplier(y, rates)
      }
    } else {
      spendByYear[def.year] += esc
    }
  }

  return {
    baseTotal,
    escalatedTotal,
    includedCount,
    totalCount: items.length,
    spendByYear,
  }
}
