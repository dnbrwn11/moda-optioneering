// Scenario model: named snapshots of the working state — per-item phase,
// include flag, CONT year-allocation, plus the four per-year escalation rates.
// Nothing else (no view state, no status, no funding class, no labor or
// participation assumptions) is captured. Those are program-level attributes
// shared across scenarios: they persist globally (PersistedState
// fundingOverrides / laborFractions / laborGlobals / participation) but never
// enter snapshots, so editing them never trips the scenario "modified" dot.
//
// Snapshots are id-keyed partial overlays, never full Item objects, so the
// static catalog (base $, qty, names) always comes from the fetched source
// data — a stale persisted payload can never resurrect old catalog data.
// applySnapshot doubles as the migration path: snapshot ids
// missing from the catalog are ignored, catalog ids missing from a snapshot
// fall back to their seeded defaults.
import type {
  ContAllocation,
  EscalationRates,
  Item,
  PhaseId,
  Trade,
} from '../types'
import { getCatalogData } from '../boot/catalog'
import { buildItems, DEFAULT_RATES } from './seeding'
import { computeTotals } from './escalation'
import type { Totals } from './escalation'
import { CONT_YEARS, ESCALATION_YEARS, PHASE_BY_ID } from './phases'
import { FUNDING_CLASSES, FUNDING_DEFAULT_BY_ID } from './funding'
import type { FundingClass, FundingOverrides } from './funding'
import { GLOBAL_DEFAULTS, LABOR_FRACTION_DEFAULTS } from './resources'
import type { GlobalAssumptions } from './resources'
import { PARTICIPATION_DEFAULTS } from './participation'
import type { ParticipationAssumptions } from './participation'
import { TRADE_ORDER } from './trades'

export interface ScenarioItemState {
  phase: PhaseId
  included: boolean
  alloc: ContAllocation
}

export interface ScenarioSnapshot {
  itemState: Record<string, ScenarioItemState>
  rates: EscalationRates
}

export interface Scenario {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  snapshot: ScenarioSnapshot
}

export const BASELINE_ID = 'baseline'
export const MAX_USER_SCENARIOS = 6

// ── Snapshot / restore ─────────────────────────────────────────────────────

export function snapshotFrom(items: Item[], rates: EscalationRates): ScenarioSnapshot {
  const itemState: Record<string, ScenarioItemState> = {}
  for (const it of items) {
    itemState[it.id] = { phase: it.phase, included: it.included, alloc: { ...it.alloc } }
  }
  return { itemState, rates: { ...rates } }
}

// The single canonical seeded state — the source-reconciled seeded
// assignments. Rebuilt from the fetched catalog on every boot, so the
// Baseline scenario always tracks the current catalog and can never be
// corrupted by anything persisted.
export const SEEDED_ITEMS: Item[] = buildItems(getCatalogData())

export const BASELINE_SCENARIO: Scenario = {
  id: BASELINE_ID,
  name: 'Baseline',
  createdAt: 0,
  updatedAt: 0,
  snapshot: snapshotFrom(SEEDED_ITEMS, DEFAULT_RATES),
}

// Baseline totals are a program constant (catalog + seeded state + default
// rates) — computed once, shared by the Δ-vs-Baseline KPI and print report.
export const BASELINE_TOTALS: Totals = computeTotals(SEEDED_ITEMS, DEFAULT_RATES)

// Overlay a snapshot's working state onto the live items (which carry the
// catalog). Catalog fields and `status` pass through untouched.
export function applySnapshot(items: Item[], snapshot: ScenarioSnapshot): Item[] {
  const seeded = BASELINE_SCENARIO.snapshot.itemState
  return items.map((it) => {
    const s = snapshot.itemState[it.id] ?? seeded[it.id]
    if (!s) return it
    return { ...it, phase: s.phase, included: s.included, alloc: { ...s.alloc } }
  })
}

// Field-wise equality over the captured state — drives the "modified" dot.
// Ids missing from either snapshot resolve to seeded defaults, mirroring
// applySnapshot, so equality is over effective state.
export function snapshotsEqual(a: ScenarioSnapshot, b: ScenarioSnapshot): boolean {
  for (const y of ESCALATION_YEARS) {
    if (Math.abs((a.rates[y] ?? 0) - (b.rates[y] ?? 0)) > 1e-12) return false
  }
  const seeded = BASELINE_SCENARIO.snapshot.itemState
  for (const it of SEEDED_ITEMS) {
    const ea = a.itemState[it.id] ?? seeded[it.id]
    const eb = b.itemState[it.id] ?? seeded[it.id]
    if (ea.phase !== eb.phase || ea.included !== eb.included) return false
    for (const y of CONT_YEARS) {
      if (ea.alloc[y] !== eb.alloc[y]) return false
    }
  }
  return true
}

// ── Persistence payload (now backed by Supabase; see lib/persistence.ts) ───

export interface PersistedState {
  version: 1
  activeScenarioId: string
  compareScenarioId: string | null
  scenarios: Scenario[] // user scenarios only — Baseline is never persisted
  working: ScenarioSnapshot // current (possibly unsaved) working state
  // Catalog-level funding reclassifications (Funding Lens). Additive field —
  // pre-feature payloads simply lack the key and sanitize to {}.
  fundingOverrides: FundingOverrides
  // Program-level planning assumptions (Resources staffing + Participation).
  // Additive fields — pre-feature payloads sanitize to the shipped defaults.
  laborFractions: Record<Trade, number>
  laborGlobals: GlobalAssumptions
  participation: ParticipationAssumptions
}

function finiteOr(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

// Coerce an untrusted snapshot to a valid one against the current catalog:
// unknown ids dropped, bad phases/allocs/rates fall back to seeded defaults.
function sanitizeSnapshot(raw: unknown): ScenarioSnapshot {
  const src = (raw ?? {}) as { itemState?: unknown; rates?: unknown }
  const rawItems = (src.itemState ?? {}) as Record<string, Partial<ScenarioItemState> | undefined>
  const itemState: Record<string, ScenarioItemState> = {}
  for (const it of SEEDED_ITEMS) {
    const e = rawItems[it.id]
    if (!e) continue // missing id → seeded default applied at restore time
    const phase =
      typeof e.phase === 'string' && e.phase in PHASE_BY_ID ? (e.phase as PhaseId) : it.phase
    const allocRaw = (e.alloc ?? {}) as Partial<ContAllocation>
    itemState[it.id] = {
      phase,
      included: typeof e.included === 'boolean' ? e.included : it.included,
      alloc: {
        2027: finiteOr(allocRaw[2027], it.alloc[2027]),
        2028: finiteOr(allocRaw[2028], it.alloc[2028]),
        2029: finiteOr(allocRaw[2029], it.alloc[2029]),
      },
    }
  }
  const ratesRaw = (src.rates ?? {}) as Partial<EscalationRates>
  const rates = { ...DEFAULT_RATES }
  for (const y of ESCALATION_YEARS) rates[y] = finiteOr(ratesRaw[y], DEFAULT_RATES[y])
  return { itemState, rates }
}

// Keep only overrides for ids in the current catalog with valid class values;
// entries equal to the derived default are dropped (they carry no information).
function sanitizeFundingOverrides(raw: unknown): FundingOverrides {
  const src = (raw ?? {}) as Record<string, unknown>
  const out: FundingOverrides = {}
  for (const [id, v] of Object.entries(src)) {
    if (!(id in FUNDING_DEFAULT_BY_ID)) continue
    if (!FUNDING_CLASSES.includes(v as FundingClass)) continue
    if (v === FUNDING_DEFAULT_BY_ID[id]) continue
    out[id] = v as FundingClass
  }
  return out
}

// Fractional (0–1) assumption values: finite, clamped into range.
function clamp01(v: unknown, fallback: number): number {
  return Math.min(1, Math.max(0, finiteOr(v, fallback)))
}

// Positive planning quantities (rates, factors): finite and non-negative.
function posOr(v: unknown, fallback: number): number {
  return Math.max(0, finiteOr(v, fallback))
}

function sanitizeTradeFractions(
  raw: unknown,
  defaults: Record<Trade, number>,
): Record<Trade, number> {
  const src = (raw ?? {}) as Partial<Record<Trade, unknown>>
  const out = {} as Record<Trade, number>
  for (const t of TRADE_ORDER) out[t] = clamp01(src[t], defaults[t])
  return out
}

function sanitizeLaborGlobals(raw: unknown): GlobalAssumptions {
  const src = (raw ?? {}) as Partial<Record<keyof GlobalAssumptions, unknown>>
  const out = { ...GLOBAL_DEFAULTS }
  for (const k of Object.keys(GLOBAL_DEFAULTS) as (keyof GlobalAssumptions)[]) {
    out[k] = posOr(src[k], GLOBAL_DEFAULTS[k])
  }
  return out
}

function sanitizeParticipation(raw: unknown): ParticipationAssumptions {
  const src = (raw ?? {}) as Partial<Record<keyof ParticipationAssumptions, unknown>>
  return {
    tradePct: sanitizeTradeFractions(src.tradePct, PARTICIPATION_DEFAULTS.tradePct),
    programGoal: clamp01(src.programGoal, PARTICIPATION_DEFAULTS.programGoal),
    apprenticePct: clamp01(src.apprenticePct, PARTICIPATION_DEFAULTS.apprenticePct),
    localHirePct: clamp01(src.localHirePct, PARTICIPATION_DEFAULTS.localHirePct),
  }
}

function sanitizePersisted(raw: Record<string, unknown>): PersistedState {
  const scenariosRaw = Array.isArray(raw.scenarios) ? raw.scenarios : []
  const scenarios: Scenario[] = []
  for (const s of scenariosRaw as Array<Record<string, unknown>>) {
    if (!s || typeof s.id !== 'string' || !s.id || s.id === BASELINE_ID) continue
    if (scenarios.length >= MAX_USER_SCENARIOS) break
    scenarios.push({
      id: s.id,
      name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Untitled',
      createdAt: finiteOr(s.createdAt, 0),
      updatedAt: finiteOr(s.updatedAt, 0),
      snapshot: sanitizeSnapshot(s.snapshot),
    })
  }
  const resolves = (id: unknown): id is string =>
    typeof id === 'string' && (id === BASELINE_ID || scenarios.some((s) => s.id === id))
  const activeScenarioId = resolves(raw.activeScenarioId) ? raw.activeScenarioId : BASELINE_ID
  const compareScenarioId = resolves(raw.compareScenarioId) ? raw.compareScenarioId : null
  const working =
    raw.working != null
      ? sanitizeSnapshot(raw.working)
      : (scenarios.find((s) => s.id === activeScenarioId) ?? BASELINE_SCENARIO).snapshot
  const fundingOverrides = sanitizeFundingOverrides(raw.fundingOverrides)
  return {
    version: 1,
    activeScenarioId,
    compareScenarioId,
    scenarios,
    working,
    fundingOverrides,
    laborFractions: sanitizeTradeFractions(raw.laborFractions, LABOR_FRACTION_DEFAULTS),
    laborGlobals: sanitizeLaborGlobals(raw.laborGlobals),
    participation: sanitizeParticipation(raw.participation),
  }
}

// Sanitize the PersistedState-shaped payload assembled from the user's
// remote rows (boot/hydrate.ts) — the same coercion the localStorage payload
// went through before the migration, so server rows are treated as exactly
// as untrusted as browser storage was.
export function sanitizeRemotePersisted(raw: unknown): PersistedState | null {
  if (raw == null || typeof raw !== 'object') return null
  return sanitizePersisted(raw as Record<string, unknown>)
}

// Resolve the store's initial persisted state from the remote payload plus an
// optional accepted one-time localStorage import. Merge rules: remote saved
// scenarios are never overwritten; imported ones append up to the cap; the
// imported working state wins only when no remote working row existed.
export function resolveInitialPersisted(
  remote: PersistedState | null,
  pendingImport: unknown,
  remoteWorkingExists: boolean,
): PersistedState | null {
  const imported =
    pendingImport != null && typeof pendingImport === 'object'
      ? sanitizePersisted(pendingImport as Record<string, unknown>)
      : null
  if (!remote) return imported
  if (!imported) return remote

  const scenarios = [...remote.scenarios]
  for (const s of imported.scenarios) {
    if (scenarios.length >= MAX_USER_SCENARIOS) break
    if (scenarios.some((m) => m.id === s.id)) continue
    scenarios.push(s)
  }
  return {
    ...remote,
    scenarios,
    working: remoteWorkingExists ? remote.working : imported.working,
  }
}
