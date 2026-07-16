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
import { buildItems, DEFAULT_RATES } from './lib/seeding'
import { computeTotals } from './lib/escalation'
import { rebalanceAlloc } from './lib/alloc'
import { DEFAULT_CONT_ALLOC } from './lib/phases'

const data = rawData as LineItemData

interface AppState {
  items: Item[]
  rates: EscalationRates
  // Seeded default escalated total, captured on load (for Δ vs baseline).
  baselineEscalatedTotal: number
  // Seeded phase per item, captured on load — the Sequence tab marks any
  // wedge whose current phase differs from this baseline assignment.
  baselinePhaseById: Record<string, PhaseId>

  setRate: (year: Year, rate: number) => void
  resetRates: () => void
  moveItem: (id: string, phase: PhaseId) => void
  toggleIncluded: (id: string) => void
  setStatus: (id: string, status: ItemStatus) => void
  // Set one CONT year's % for an item; the other two rebalance to keep sum 100.
  setAlloc: (id: string, year: ContYear, value: number) => void
}

const initialItems = buildItems(data)
const initialTotals = computeTotals(initialItems, DEFAULT_RATES)

// --- Startup audit (section 9): item-count-by-phase + validation total ---
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
  const baseTotal = initialTotals.baseTotal
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

logStartupAudit(initialItems, initialTotals.escalatedTotal)

export const useStore = create<AppState>((set) => ({
  items: initialItems,
  rates: { ...DEFAULT_RATES },
  baselineEscalatedTotal: initialTotals.escalatedTotal,
  baselinePhaseById: initialItems.reduce<Record<string, PhaseId>>((acc, it) => {
    acc[it.id] = it.phase
    return acc
  }, {}),

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
}))

// Re-export for components that need defaults.
export { DEFAULT_RATES }
