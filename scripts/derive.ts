// Seed-time derivation of per-item defaults (phase, status, funding class).
// Moved out of the client (src/lib/seeding.ts / src/lib/funding.ts) so the
// name-matching rules — which encode scope and sequencing knowledge from the
// source estimate — never ship in the JS bundle. The client reads the derived
// values from the line_items table; these rules run only when seeding.
import type {
  FundingClass,
  ItemStatus,
  LevelId,
  LineItemData,
  PhaseId,
  Trade,
} from '../src/types'
import { DEFAULT_CONT_ALLOC } from '../src/lib/phases'

// OVERLAY systems that default to "required" (true building needs), plus AGING.
// Matched by substring against the OVERLAY item names.
const REQUIRED_OVERLAY_PATTERNS = [
  'hvac',
  'electrical',
  'plumbing',
  'fire protection',
  'vertical transportation',
  'audio/visual',
]

// Default status: everything "value-add" except the OVERLAY systems above and AGING.
function seedStatus(level: LevelId, name: string): ItemStatus {
  const n = name.toLowerCase()
  if (level === 'AGING') return 'required'
  if (level === 'OVERLAY' && REQUIRED_OVERLAY_PATTERNS.some((p) => n.includes(p))) {
    return 'required'
  }
  return 'value-add'
}

// Default phase seeding from Image 1 (section 9). Rules applied in order;
// first match wins. Validated to land the escalated grand total at ~$403.8M
// under flat 5%/yr with all items included.
function seedPhase(level: LevelId, name: string): PhaseId {
  const n = name.toLowerCase()

  // All OVERLAY + AGING -> CONT (MEP/AV/structural/envelope/VT/food svc throughout)
  if (level === 'OVERLAY' || level === 'AGING') return 'CONT'

  if (level === 'L100') {
    if (n.includes('home team')) return '1OS'
    if (n.includes('sideline club #2')) return '1OS'
    if (n.includes('kitchen') || n.includes('commissary')) return '1OS'
    if (n.includes('staff lockers')) return '1OS'
    if (n.includes('loading dock')) return '1OS'
    if (n.includes('aux lockers')) return '1DS'
    if (n.includes('wnba')) return '2OS'
    if (n.includes('courtside')) return '2OS'
    if (n.includes('sideline club - east')) return '2OS'
    return '3OS'
  }

  if (level === 'L200') {
    if (n.includes('circular entry')) return '2OS'
    if (n.includes('north entry')) return '1OS'
    if (n.includes('restrooms - group #1')) return '1OS'
    if (n.includes('restrooms - group #2')) return '1DS'
    if (n.includes('concessions')) return '1OS'
    return '3OS'
  }

  if (level === 'L300') {
    if (n.includes('north neighborhood')) return '1OS'
    if (n.includes('rotunda')) return '2OS'
    if (n.includes('south neighborhood')) return '2OS'
    if (n.includes('center court') || n.includes('club level suites')) return '3OS'
    return '3OS'
  }

  if (level === 'L400') return '3OS'

  if (level === 'L500') {
    if (n.includes('restrooms')) return '2OS'
    return '2DS'
  }

  if (level === 'L700') {
    if (n.includes('press level finishes')) return '2OS'
    return '2DS'
  }

  return '3OS' // fallback
}

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
// (OV-05) deliberately land in `general` as fan-facing scope.
function deriveFundingClass(level: LevelId, trade: Trade, name: string): FundingClass {
  if (level === 'AGING') return 'systems'
  if (/mechanical/i.test(name)) return 'systems'
  if (SYSTEMS_TRADES.has(trade)) return 'systems'
  if (PREMIUM_NAME.test(name)) return 'premium'
  return 'general'
}

export interface LineItemRow {
  id: string
  level_id: LevelId
  level_name: string
  level_order: number
  item_order: number
  name: string
  qty: number
  unit: number | null
  base: number
  derived: boolean
  trade: Trade
  status: ItemStatus
  phase: PhaseId
  funding_class: FundingClass
  alloc_2027: number
  alloc_2028: number
  alloc_2029: number
}

// Flatten the raw catalog into fully derived line_items rows.
export function buildLineItemRows(data: LineItemData): LineItemRow[] {
  const rows: LineItemRow[] = []
  data.levels.forEach((level, levelOrder) => {
    level.items.forEach((raw, itemOrder) => {
      rows.push({
        id: raw.id,
        level_id: level.id,
        level_name: level.name,
        level_order: levelOrder,
        item_order: itemOrder,
        name: raw.name,
        qty: raw.qty,
        unit: raw.unit,
        base: raw.base,
        derived: Boolean(raw.derived),
        trade: raw.trade,
        status: seedStatus(level.id, raw.name),
        phase: seedPhase(level.id, raw.name),
        funding_class: deriveFundingClass(level.id, raw.trade, raw.name),
        alloc_2027: DEFAULT_CONT_ALLOC[2027],
        alloc_2028: DEFAULT_CONT_ALLOC[2028],
        alloc_2029: DEFAULT_CONT_ALLOC[2029],
      })
    })
  })
  return rows
}
