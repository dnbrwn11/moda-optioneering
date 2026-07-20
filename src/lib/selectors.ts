import { useMemo } from 'react'
import { useStore } from '../store'
import { computeTotals } from './escalation'
import type { Totals } from './escalation'
import type { PhaseId } from '../types'
import {
  applySnapshot,
  BASELINE_ID,
  BASELINE_SCENARIO,
  snapshotFrom,
  snapshotsEqual,
} from './scenarios'
import type { Scenario } from './scenarios'

// Live totals derived from current items + rates.
export function useTotals(): Totals {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  return useMemo(() => computeTotals(items, rates), [items, rates])
}

// ── Scenario selectors ─────────────────────────────────────────────────────

// Resolve a scenario id against Baseline + the saved list.
export function useScenarioById(id: string | null): Scenario | null {
  const scenarios = useStore((s) => s.scenarios)
  if (id === null) return null
  if (id === BASELINE_ID) return BASELINE_SCENARIO
  return scenarios.find((s) => s.id === id) ?? null
}

export function useActiveScenario(): Scenario {
  const id = useStore((s) => s.activeScenarioId)
  return useScenarioById(id) ?? BASELINE_SCENARIO
}

export function useCompareScenario(): Scenario | null {
  const id = useStore((s) => s.compareScenarioId)
  return useScenarioById(id)
}

// A scenario's Totals — its snapshot materialized over the live catalog and
// run through the same computeTotals as everything else, so every existing
// derivation (spendByYearByKind, cashFlowCurve, …) works on it unchanged.
export function useScenarioTotals(scenario: Scenario | null): Totals | null {
  const items = useStore((s) => s.items)
  return useMemo(
    () =>
      scenario
        ? computeTotals(applySnapshot(items, scenario.snapshot), scenario.snapshot.rates)
        : null,
    [items, scenario],
  )
}

// True when the working state differs from the active scenario's snapshot —
// derived, never stored, so it can't drift out of sync.
export function useIsModified(): boolean {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  const active = useActiveScenario()
  return useMemo(
    () => !snapshotsEqual(snapshotFrom(items, rates), active.snapshot),
    [items, rates, active],
  )
}

// Reference phase map for moved-item markers: the compare target's phases
// when Compare is on, Baseline's otherwise. Compare snapshots missing an id
// (catalog grew since save) fall back to the Baseline phase.
export function useRefPhaseById(): Record<string, PhaseId> {
  const compare = useCompareScenario()
  return useMemo(() => {
    const out: Record<string, PhaseId> = {}
    for (const [id, s] of Object.entries(BASELINE_SCENARIO.snapshot.itemState)) {
      out[id] = s.phase
    }
    if (compare) {
      for (const [id, s] of Object.entries(compare.snapshot.itemState)) {
        if (id in out) out[id] = s.phase
      }
    }
    return out
  }, [compare])
}
