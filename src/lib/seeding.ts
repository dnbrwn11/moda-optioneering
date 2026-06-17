import type {
  EscalationRates,
  Item,
  ItemStatus,
  LevelId,
  LineItemData,
  PhaseId,
  RawItem,
} from '../types'
import { DEFAULT_CONT_ALLOC } from './phases'

// Flat 5%/yr default (the Big Kahuna basis).
export const DEFAULT_RATES: EscalationRates = {
  2026: 0.05,
  2027: 0.05,
  2028: 0.05,
  2029: 0.05,
}

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
// first match wins. Validated to land the escalated grand total at ~$403.2M
// under flat 5%/yr with all items included.
function seedPhase(level: LevelId, name: string): PhaseId {
  const n = name.toLowerCase()

  // All OVERLAY + AGING -> CONT (MEP/AV/structural/envelope/VT/food svc throughout)
  if (level === 'OVERLAY' || level === 'AGING') return 'CONT'

  if (level === 'L100') {
    if (n.includes('home team')) return '1OS' // NBA Lockers (Home Team)
    if (n.includes('sideline club #2')) return '1OS'
    if (n.includes('kitchen') || n.includes('commissary')) return '1OS' // food service
    if (n.includes('staff lockers')) return '1OS'
    if (n.includes('loading dock')) return '1OS' // NBA Team Parking / Add Dock
    if (n.includes('aux lockers')) return '1DS' // Video/Aux Lockers
    if (n.includes('wnba')) return '2OS'
    if (n.includes('courtside')) return '2OS'
    if (n.includes('sideline club - east')) return '2OS' // Sideline Club (East)
    return '3OS' // New Club Entries, Balance of Event Lvl
  }

  if (level === 'L200') {
    if (n.includes('circular entry')) return '2OS' // Secondary/Circular entry
    if (n.includes('north entry')) return '1OS' // North entry
    if (n.includes('restrooms - group #1')) return '1OS' // West + North restrooms
    if (n.includes('restrooms - group #2')) return '1DS' // balance of North restrooms
    if (n.includes('concessions')) return '1OS'
    return '3OS' // Primary entrance, flooring/sealants, balance
  }

  if (level === 'L300') {
    if (n.includes('north neighborhood')) return '1OS'
    if (n.includes('rotunda')) return '2OS'
    if (n.includes('south neighborhood')) return '2OS'
    if (n.includes('center court') || n.includes('club level suites')) return '3OS'
    return '3OS' // Premium club / suites
  }

  // L400 (all Suite Level clubs + lobbies) -> 3OS
  if (level === 'L400') return '3OS'

  if (level === 'L500') {
    if (n.includes('restrooms')) return '2OS'
    return '2DS'
  }

  if (level === 'L700') {
    if (n.includes('press level finishes')) return '2OS'
    return '2DS' // Alaska Airlines Boxes
  }

  return '3OS' // fallback (logged by caller)
}

// Build runtime items from raw data, seeding default phase/status/included.
// Logs any item that fell through to the UNASSIGNED fallback.
export function buildItems(data: LineItemData): Item[] {
  const items: Item[] = []
  for (const level of data.levels) {
    for (const raw of level.items as RawItem[]) {
      items.push({
        id: raw.id,
        name: raw.name,
        level: level.id,
        levelName: level.name,
        qty: raw.qty,
        unit: raw.unit,
        base: raw.base,
        derived: Boolean(raw.derived),
        phase: seedPhase(level.id, raw.name),
        included: true,
        status: seedStatus(level.id, raw.name),
        // Even-ish default split (used while phase === 'CONT').
        alloc: { ...DEFAULT_CONT_ALLOC },
      })
    }
  }
  return items
}
