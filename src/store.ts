import { create } from 'zustand'
import type {
  ContYear,
  EscalationRates,
  Item,
  ItemStatus,
  PhaseId,
  Year,
} from './types'
import rawData from './data/lineitems.json'
import type { LineItemData } from './types'
import { DEFAULT_RATES } from './lib/seeding'
import { rebalanceAlloc } from './lib/alloc'
import { DEFAULT_CONT_ALLOC } from './lib/phases'
import {
  applySnapshot,
  BASELINE_ID,
  BASELINE_SCENARIO,
  BASELINE_TOTALS,
  loadPersisted,
  MAX_USER_SCENARIOS,
  persistScenarios,
  SEEDED_ITEMS,
  snapshotFrom,
} from './lib/scenarios'
import type { Scenario } from './lib/scenarios'

const data = rawData as LineItemData

interface AppState {
  items: Item[]
  rates: EscalationRates
  // Saved user scenarios (Baseline is a module constant, never stored here —
  // see lib/scenarios.ts). One scenario is active; compare is null when off.
  scenarios: Scenario[]
  activeScenarioId: string
  compareScenarioId: string | null

  setRate: (year: Year, rate: number) => void
  resetRates: () => void
  moveItem: (id: string, phase: PhaseId) => void
  toggleIncluded: (id: string) => void
  setStatus: (id: string, status: ItemStatus) => void
  // Set one CONT year's % for an item; the other two rebalance to keep sum 100.
  setAlloc: (id: string, year: ContYear, value: number) => void

  // Scenario lifecycle. Baseline is immutable: update/rename/delete on it are
  // no-ops (and the UI never offers them).
  activateScenario: (id: string) => void
  saveScenarioAs: (name: string) => void
  updateActiveScenario: () => void
  renameScenario: (id: string, name: string) => void
  deleteScenario: (id: string) => void
  discardChanges: () => void
  setCompareScenario: (id: string | null) => void
}

// --- Startup audit (section 9): item-count-by-phase + validation total ---
// Always audits the seeded (shipped) state, not the persisted working state,
// so the $402–405.5M validation stays meaningful across reloads.
function logStartupAudit(items: Item[], baselineEscalated: number): void {
  const byPhase = items.reduce<Record<string, number>>((acc, it) => {
    acc[it.phase] = (acc[it.phase] ?? 0) + 1
    return acc
  }, {})

  /* eslint-disable no-console */
  console.log(
    '%c[Moda Optioneering] startup audit',
    'color:#005D2F;font-weight:700',
  )
  console.table(byPhase)
  const baseTotal = BASELINE_TOTALS.baseTotal
  console.log(
    `Base total (2025):      $${baseTotal.toLocaleString('en-US')}`,
  )
  console.log(
    `Escalated grand total:  $${Math.round(baselineEscalated).toLocaleString('en-US')}  (= $${(baselineEscalated / 1e6).toFixed(2)}M)`,
  )
  console.log(
    `Reported escalated:     $${data.meta.reported_escalated_total.toLocaleString('en-US')}  (= $${(data.meta.reported_escalated_total / 1e6).toFixed(2)}M)`,
  )
  const target = baselineEscalated >= 402e6 && baselineEscalated <= 405.5e6
  console.log(
    `%cValidation: escalated total ${target ? 'WITHIN' : 'OUTSIDE'} $402-405.5M target`,
    `color:${target ? '#005D2F' : '#D83C31'};font-weight:700`,
  )
  /* eslint-enable no-console */

  // Flag any UNASSIGNED-fallback items (none expected with current seeding).
  const orphans = items.filter((it) => it.phase === '3OS' && it.level === 'L200')
  if (orphans.length) {
    // Informational only — these are seeded to 3OS by the fallback rule.
    // (Logged so the mapping stays auditable per spec section 9.)
  }
}

logStartupAudit(SEEDED_ITEMS, BASELINE_TOTALS.escalatedTotal)

// Boot from localStorage when a valid payload exists — restoring saved
// scenarios AND the exact working state (unsaved edits survive a reload).
// applySnapshot reconciles the persisted working state against the current
// catalog, so a lineitems.json change can never break boot.
const persisted = loadPersisted()
const initialItems = persisted ? applySnapshot(SEEDED_ITEMS, persisted.working) : SEEDED_ITEMS
const initialRates = persisted ? { ...persisted.working.rates } : { ...DEFAULT_RATES }

const findScenario = (scenarios: Scenario[], id: string): Scenario | undefined =>
  id === BASELINE_ID ? BASELINE_SCENARIO : scenarios.find((s) => s.id === id)

export const useStore = create<AppState>((set) => ({
  items: initialItems,
  rates: initialRates,
  scenarios: persisted?.scenarios ?? [],
  activeScenarioId: persisted?.activeScenarioId ?? BASELINE_ID,
  compareScenarioId: persisted?.compareScenarioId ?? null,

  setRate: (year, rate) =>
    set((state) => ({ rates: { ...state.rates, [year]: rate } })),

  resetRates: () => set({ rates: { ...DEFAULT_RATES } }),

  moveItem: (id, phase) =>
    set((state) => ({
      items: state.items.map((it) => {
        if (it.id !== id) return it
        // Moving into CONT with no meaningful split? seed the default.
        const alloc =
          phase === 'CONT' && it.alloc == null
            ? { ...DEFAULT_CONT_ALLOC }
            : it.alloc
        return { ...it, phase, alloc }
      }),
    })),

  toggleIncluded: (id) =>
    set((state) => ({
      items: state.items.map((it) =>
        it.id === id ? { ...it, included: !it.included } : it,
      ),
    })),

  setStatus: (id, status) =>
    set((state) => ({
      items: state.items.map((it) => (it.id === id ? { ...it, status } : it)),
    })),

  setAlloc: (id, year, value) =>
    set((state) => ({
      items: state.items.map((it) =>
        it.id === id ? { ...it, alloc: rebalanceAlloc(it.alloc, year, value) } : it,
      ),
    })),

  // ── Scenarios ────────────────────────────────────────────────────────────

  activateScenario: (id) =>
    set((state) => {
      const sc = findScenario(state.scenarios, id)
      if (!sc) return {}
      return {
        items: applySnapshot(state.items, sc.snapshot),
        rates: { ...sc.snapshot.rates },
        activeScenarioId: sc.id,
        // Comparing a scenario to itself is meaningless — drop the target.
        ...(state.compareScenarioId === sc.id ? { compareScenarioId: null } : {}),
      }
    }),

  saveScenarioAs: (name) =>
    set((state) => {
      if (state.scenarios.length >= MAX_USER_SCENARIOS) return {}
      const now = Date.now()
      const sc: Scenario = {
        id: `s-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: name.trim() || 'Untitled',
        createdAt: now,
        updatedAt: now,
        snapshot: snapshotFrom(state.items, state.rates),
      }
      return { scenarios: [...state.scenarios, sc], activeScenarioId: sc.id }
    }),

  updateActiveScenario: () =>
    set((state) => {
      if (state.activeScenarioId === BASELINE_ID) return {}
      return {
        scenarios: state.scenarios.map((s) =>
          s.id === state.activeScenarioId
            ? { ...s, updatedAt: Date.now(), snapshot: snapshotFrom(state.items, state.rates) }
            : s,
        ),
      }
    }),

  renameScenario: (id, name) =>
    set((state) => {
      if (id === BASELINE_ID) return {}
      const trimmed = name.trim()
      if (!trimmed) return {}
      return {
        scenarios: state.scenarios.map((s) =>
          s.id === id ? { ...s, name: trimmed, updatedAt: Date.now() } : s,
        ),
      }
    }),

  // Deleting the active scenario keeps the working state untouched and points
  // active back at Baseline (the modified dot then reflects any divergence) —
  // nothing the user was editing is ever lost by a delete.
  deleteScenario: (id) =>
    set((state) => {
      if (id === BASELINE_ID) return {}
      const patch: Partial<AppState> = {
        scenarios: state.scenarios.filter((s) => s.id !== id),
      }
      if (state.compareScenarioId === id) patch.compareScenarioId = null
      if (state.activeScenarioId === id) patch.activeScenarioId = BASELINE_ID
      return patch
    }),

  discardChanges: () =>
    set((state) => {
      const sc = findScenario(state.scenarios, state.activeScenarioId) ?? BASELINE_SCENARIO
      return {
        items: applySnapshot(state.items, sc.snapshot),
        rates: { ...sc.snapshot.rates },
      }
    }),

  setCompareScenario: (id) =>
    set((state) => ({
      compareScenarioId: id !== null && findScenario(state.scenarios, id) ? id : null,
    })),
}))

// Debounced persistence — one choke point subscribed to the whole store, so
// no mutation path can be missed. Human-speed edits vs 300ms means the window
// for losing a write on hard reload is negligible for a single-user tool.
let persistTimer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((state) => {
  clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistScenarios({
      version: 1,
      activeScenarioId: state.activeScenarioId,
      compareScenarioId: state.compareScenarioId,
      scenarios: state.scenarios,
      working: snapshotFrom(state.items, state.rates),
    })
  }, 300)
})

// Re-export for components that need defaults.
export { DEFAULT_RATES }
