// Funding Lens — illustrative funding classification per the Moda Center
// renovation term sheet (public record, July 17, 2026 draft). Strictly a VIEW
// dimension: nothing here feeds cost/escalation math (computeTotals is
// untouched); these are parallel read-only aggregations over the same
// escalatedCost primitive, so reconciliation invariants hold by construction.
import type { ContYear, EscalationRates, Item, LevelId, LineItemData, Trade } from '../types'
import rawData from '../data/lineitems.json'
import { escalatedCost, yearMultiplier } from './escalation'
import { CONT_YEARS, PHASE_BY_ID } from './phases'
import { fundingColors } from './tokens'

export type FundingClass = 'systems' | 'premium' | 'general'

// Canonical order — chip cycle order, KPI order, and chart stack order
// (systems bottom, premium top).
export const FUNDING_CLASSES: FundingClass[] = ['systems', 'general', 'premium']

// Muted hues, distinct from KIND_COLORS (analytics.ts) and the trade accents;
// alert orange stays reserved. Chips always carry a text label (SYS/PREM/GEN)
// so identity is never color-alone.
export const FUNDING_META: Record<
  FundingClass,
  { label: string; short: string; color: string }
> = {
  systems: { label: 'Building Systems & Infrastructure', short: 'SYS', color: fundingColors.systems },
  premium: { label: 'Premium Spaces', short: 'PREM', color: fundingColors.premium },
  general: { label: 'General Fan Amenities', short: 'GEN', color: fundingColors.general },
}

// Inline style for a funding chip: tinted fill, accent text + border
// (same treatment as tradeChipStyle).
export function fundingChipStyle(cls: FundingClass): React.CSSProperties {
  const hex = FUNDING_META[cls].color
  return {
    color: hex,
    backgroundColor: `${hex}14`,
    borderColor: `${hex}40`,
  }
}

// Shown everywhere the lens surfaces — the classification is illustrative only.
export const FUNDING_CAPTION =
  'Illustrative funding classification — eligibility to be defined in Definitive Agreements.'

// ── Derivation ─────────────────────────────────────────────────────────────

const SYSTEMS_TRADES = new Set<Trade>([
  'HVAC',
  'Electrical & Low Voltage',
  'Plumbing',
  'Fire Protection',
  'Vertical Transportation',
  'Structural/Concrete Repair',
  'Building Envelope',
  'Bowl & Rigging',
  'Sitework',
  'Acoustical & Specialties',
  'Audio Visual',
])

const PREMIUM_NAME = /club|suite|courtside|sideline|premium|rotunda|boxes/i

// Ordered rules, first match wins. Seating (OV-06) and Food Service Equipment
// (OV-05) deliberately land in `general` as fan-facing scope — judgment calls;
// that is exactly what the per-item override is for.
export function deriveFundingClass(level: LevelId, trade: Trade, name: string): FundingClass {
  if (level === 'AGING') return 'systems'
  if (/mechanical/i.test(name)) return 'systems'
  if (SYSTEMS_TRADES.has(trade)) return 'systems'
  if (PREMIUM_NAME.test(name)) return 'premium'
  return 'general'
}

// Derived default per catalog item, built once from the shipped data (raw
// levels, not SEEDED_ITEMS, so this module never imports the scenario layer).
export const FUNDING_DEFAULT_BY_ID: Record<string, FundingClass> = (() => {
  const out: Record<string, FundingClass> = {}
  for (const level of (rawData as LineItemData).levels) {
    for (const it of level.items) {
      out[it.id] = deriveFundingClass(level.id, it.trade, it.name)
    }
  }
  return out
})()

// Per-item user reclassifications — catalog-level (shared across scenarios),
// keyed by item id, holding only departures from the derived default.
export type FundingOverrides = Record<string, FundingClass>

export function effectiveClass(id: string, overrides: FundingOverrides): FundingClass {
  return overrides[id] ?? FUNDING_DEFAULT_BY_ID[id] ?? 'general'
}

// ── Aggregations (parallel to computeTotals, never modifying it) ───────────

// Escalated $ per funding class over included items (excluded items are 0 via
// escalatedCost). Sums to Totals.escalatedTotal by construction.
export function fundingTotals(
  items: Item[],
  rates: EscalationRates,
  overrides: FundingOverrides,
): Record<FundingClass, number> {
  const out: Record<FundingClass, number> = { systems: 0, premium: 0, general: 0 }
  for (const item of items) {
    out[effectiveClass(item.id, overrides)] += escalatedCost(item, rates)
  }
  return out
}

export interface FundingYearStack {
  year: ContYear
  label: string
  systems: number
  premium: number
  general: number
}

// Escalated spend landing in each calendar year, split by funding class.
// Discrete items land whole in their phase's year; CONT items split per their
// allocation, each year's portion escalated to that year — the same arithmetic
// computeTotals uses for spendByYear, so per-year stacks foot to it.
export function spendByYearByFunding(
  items: Item[],
  rates: EscalationRates,
  overrides: FundingOverrides,
): FundingYearStack[] {
  const rows: FundingYearStack[] = CONT_YEARS.map((y) => ({
    year: y,
    label: String(y),
    systems: 0,
    premium: 0,
    general: 0,
  }))
  const byYear = new Map(rows.map((r) => [r.year, r]))

  for (const item of items) {
    if (!item.included) continue
    const cls = effectiveClass(item.id, overrides)
    const def = PHASE_BY_ID[item.phase]
    if (def.year === null) {
      for (const y of CONT_YEARS) {
        byYear.get(y)![cls] +=
          item.base * (item.alloc[y] / 100) * yearMultiplier(y, rates)
      }
    } else {
      byYear.get(def.year as ContYear)![cls] += escalatedCost(item, rates)
    }
  }
  return rows
}

// Chart stack series — systems bottom, general middle, premium top.
export const FUNDING_SERIES: { key: FundingClass; label: string; color: string }[] =
  FUNDING_CLASSES.map((key) => ({
    key,
    label: FUNDING_META[key].label,
    color: FUNDING_META[key].color,
  }))

// ── Term-sheet deal context (static, display-only) ─────────────────────────

export const TERM_SHEET_LABEL = 'Per renovation term sheet draft, July 17, 2026'

export const PUBLIC_FUNDING_CAPS = [
  { source: 'City of Portland', cap: 120e6, note: '' },
  { source: 'Multnomah County', cap: 88e6, note: '' },
  { source: 'State of Oregon', cap: 365e6, note: 'SB 1501' },
] as const

export const PUBLIC_FUNDING_TOTAL_CAP = 573e6

export const RENOVATION_BUDGET_NOTE =
  'The $573M Renovation Budget includes design, soft costs, and contingency beyond this tool’s construction-cost scope — not directly comparable to the construction totals shown here.'
