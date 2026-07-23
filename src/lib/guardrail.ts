import type { Item, PhaseId } from '../types'
import { PHASE_BY_ID } from './phases'
import { getAppConstants } from '../boot/catalog'

// Soft per-phase capacity = the physical work volume an NBA construction window
// can absorb, measured in 2025 base dollars (a throughput proxy — escalation
// must NOT inflate the load against a fixed ceiling). Offseason windows hold
// more than during-season windows. Configurable; we warn, never hard-block.
//
// Reference point (tooltip): Crypto.com Arena ran ~50-65 interrupted workdays
// per phase, midnight-10am.
export interface CapacityConfig {
  offseasonBase: number
  duringSeasonBase: number
}

// Served from app_constants — the ceiling dollars no longer ship in the bundle.
export const DEFAULT_CAPACITY: CapacityConfig = getAppConstants().guardrail_capacity

export function phaseCapacity(phase: PhaseId, cfg = DEFAULT_CAPACITY): number | null {
  const def = PHASE_BY_ID[phase]
  if (def.kind === 'continuous') return null // spans all windows — no single ceiling
  return def.kind === 'offseason' ? cfg.offseasonBase : cfg.duringSeasonBase
}

export interface PhaseLoad {
  baseLoad: number // included base $ assigned to the phase
  count: number
  capacity: number | null
  overloaded: boolean
  utilization: number // baseLoad / capacity (0 when no capacity)
}

// Physical load = included base dollars in the phase (escalation excluded).
export function phaseLoad(
  phase: PhaseId,
  itemsInPhase: Item[],
  cfg = DEFAULT_CAPACITY,
): PhaseLoad {
  const included = itemsInPhase.filter((it) => it.included)
  const baseLoad = included.reduce((sum, it) => sum + it.base, 0)
  const capacity = phaseCapacity(phase, cfg)
  return {
    baseLoad,
    count: included.length,
    capacity,
    overloaded: capacity !== null && baseLoad > capacity,
    utilization: capacity ? baseLoad / capacity : 0,
  }
}

// Phase-kind-aware warning text (orange ⚠ guardrail — alerts only).
export function overloadMessage(phase: PhaseId): string {
  const def = PHASE_BY_ID[phase]
  return def.kind === 'offseason'
    ? 'Exceeds typical offseason window throughput.'
    : 'Exceeds what an NBA during-season window can absorb.'
}

export const CAPACITY_TOOLTIP =
  'Soft capacity = physical work an NBA window can absorb (2025 base $). ' +
  'Reference: Crypto.com Arena ran ~50–65 interrupted workdays per phase, ' +
  'midnight–10am. This is a non-blocking warning, not a hard limit.'
