import type { EscalationRates, Item, PhaseId } from '../types'
import { escalatedCost } from './escalation'
import { PHASE_BY_ID } from './phases'

// Soft per-phase capacity = what an NBA construction window can physically
// absorb. Configurable constants; offseason holds more than during-season.
// (Reference: Crypto.com Arena ran ~50-65 interrupted workdays per phase,
// midnight-10am. We warn, never hard-block.)
export interface CapacityConfig {
  offseasonDollars: number
  duringSeasonDollars: number
  // CONT spans all windows, so no single-window ceiling applies.
}

export const DEFAULT_CAPACITY: CapacityConfig = {
  offseasonDollars: 45_000_000,
  duringSeasonDollars: 18_000_000,
}

export function phaseCapacity(phase: PhaseId, cfg = DEFAULT_CAPACITY): number | null {
  const def = PHASE_BY_ID[phase]
  if (def.kind === 'continuous') return null
  if (def.kind === 'offseason') return cfg.offseasonDollars
  return cfg.duringSeasonDollars
}

export interface PhaseLoad {
  escalated: number
  count: number
  capacity: number | null
  overloaded: boolean
}

export function phaseLoad(
  phase: PhaseId,
  items: Item[],
  rates: EscalationRates,
  cfg = DEFAULT_CAPACITY,
): PhaseLoad {
  const inPhase = items.filter((it) => it.phase === phase && it.included)
  const escalated = inPhase.reduce((sum, it) => sum + escalatedCost(it, rates), 0)
  const capacity = phaseCapacity(phase, cfg)
  return {
    escalated,
    count: inPhase.length,
    capacity,
    overloaded: capacity !== null && escalated > capacity,
  }
}
