// Capacity-tab derivations. Reuses the guardrail throughput model verbatim —
// per-window load is included BASE dollars (escalation excluded, per the
// guardrail's "throughput proxy" rule) against the $50M / $8M ceilings. No new
// cost or escalation logic is introduced here.
import type { Item } from '../types'
import type { CapacityConfig, PhaseLoad } from './guardrail'
import { phaseLoad } from './guardrail'
import { TIME_PHASES } from './phases'
import type { PhaseDef } from './phases'

// Crypto.com Arena comp: ~50–65 interrupted workdays per phase (midnight–10am).
export const WORKDAYS_COMP = { min: 50, max: 65 } as const
export const DEFAULT_WORKDAYS = 57 // midpoint of the comp range

export interface WindowCapacity {
  phase: PhaseDef
  load: PhaseLoad
  capacity: number // window ceiling in base $ (0 only if misconfigured)
  utilization: number // baseLoad / capacity
  headroom: number // capacity − baseLoad (negative = over ceiling)
  perWorkday: number // baseLoad / workdays  — implied $/workday of loaded scope
  capacityPerWorkday: number // capacity / workdays — the ceiling as a daily rate
}

export function windowCapacityRows(
  items: Item[],
  cfg: CapacityConfig,
  workdays: number,
): WindowCapacity[] {
  return TIME_PHASES.map((phase) => {
    const inPhase = items.filter((it) => it.phase === phase.id)
    const load = phaseLoad(phase.id, inPhase, cfg)
    const capacity = load.capacity ?? 0
    return {
      phase,
      load,
      capacity,
      utilization: load.utilization,
      headroom: capacity - load.baseLoad,
      perWorkday: workdays > 0 ? load.baseLoad / workdays : 0,
      capacityPerWorkday: workdays > 0 ? capacity / workdays : 0,
    }
  })
}

// Utilization state — drives the escalating green → amber → orange encoding.
// Paired with a text label everywhere so identity is never color-alone.
export type CapacityState = 'headroom' | 'near' | 'over'

export function capacityState(utilization: number): CapacityState {
  if (utilization >= 1) return 'over'
  if (utilization >= 0.8) return 'near'
  return 'headroom'
}
