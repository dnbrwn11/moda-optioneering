import type { CatalogData, EscalationRates, Item } from '../types'
import { getAppConstants } from '../boot/catalog'

// Default per-year escalation rates — served from app_constants. This module
// evaluates inside the lazy app chunk, after boot has called initCatalog().
const RATES = getAppConstants().escalation_default_rates
export const DEFAULT_RATES: EscalationRates = {
  2026: RATES[2026],
  2027: RATES[2027],
  2028: RATES[2028],
  2029: RATES[2029],
}

// Build runtime items from the fetched catalog. The seeded phase/status/
// funding defaults are stored columns, computed once at seed time
// (scripts/derive.ts) — the name-matching derivation rules no longer ship in
// the bundle.
export function buildItems(data: CatalogData): Item[] {
  const items: Item[] = []
  for (const level of data.levels) {
    for (const raw of level.items) {
      items.push({
        id: raw.id,
        name: raw.name,
        level: level.id,
        levelName: level.name,
        qty: raw.qty,
        unit: raw.unit,
        base: raw.base,
        derived: Boolean(raw.derived),
        trade: raw.trade,
        phase: raw.phase,
        included: true,
        status: raw.status,
        alloc: { ...raw.alloc },
      })
    }
  }
  return items
}
