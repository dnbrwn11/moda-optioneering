// Authenticated boot fetch: pulls the four tables in parallel, validates and
// assembles them into the catalog shape the app modules expect, and returns
// everything initCatalog() needs. All-or-nothing: any failed query throws and
// Boot renders the retry screen — the app never renders on partial data.
import { getSupabase } from './supabaseClient'
import type { AppConstants, HydratedSession } from './catalog'
import type {
  CatalogData,
  CatalogItem,
  CatalogLevel,
  FundingClass,
  ItemStatus,
  LevelId,
  LineItemData,
  PhaseId,
} from '../types'

export interface HydrateResult {
  data: CatalogData
  constants: AppConstants
  session: HydratedSession
}

const CONSTANT_KEYS = [
  'meta',
  'guardrail_capacity',
  'season_windows',
  'escalation_default_rates',
  'public_funding_caps',
  'startup_audit_band',
  'sequence_captions',
] as const

interface LineItemRow {
  id: string
  level_id: LevelId
  level_name: string
  name: string
  qty: number
  unit: number | null
  base: number
  derived: boolean
  trade: string
  status: ItemStatus
  phase: PhaseId
  funding_class: FundingClass
  alloc_2027: number
  alloc_2028: number
  alloc_2029: number
}

interface ScenarioRow {
  id: string
  name: string
  snapshot: unknown
  version: number
  created_at: string
  updated_at: string
}

function assembleCatalog(rows: LineItemRow[], meta: LineItemData['meta']): CatalogData {
  if (!rows.length) throw new Error('reference data is empty — has the database been seeded?')
  const levels: CatalogLevel[] = []
  let current: CatalogLevel | null = null
  for (const r of rows) {
    for (const field of ['id', 'name', 'base', 'trade', 'status', 'phase', 'funding_class'] as const) {
      if (r[field] == null) throw new Error(`line_items row ${r.id ?? '?'} is missing '${field}'`)
    }
    if (!current || current.id !== r.level_id) {
      current = { id: r.level_id, name: r.level_name, items: [] }
      levels.push(current)
    }
    const item: CatalogItem = {
      id: r.id,
      name: r.name,
      qty: Number(r.qty),
      unit: r.unit == null ? null : Number(r.unit),
      base: Number(r.base),
      derived: Boolean(r.derived),
      trade: r.trade as CatalogItem['trade'],
      phase: r.phase,
      status: r.status,
      fundingClass: r.funding_class,
      alloc: {
        2027: Number(r.alloc_2027),
        2028: Number(r.alloc_2028),
        2029: Number(r.alloc_2029),
      },
    }
    current.items.push(item)
  }
  return { meta, levels }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Loading took too long — check your connection.')), ms),
    ),
  ])
}

async function doHydrate(): Promise<HydrateResult> {
  const supabase = getSupabase()
  const { data: authData, error: authError } = await supabase.auth.getSession()
  if (authError || !authData.session) throw new Error('No active session — sign in again.')
  const user = authData.session.user

  const [li, ac, sc, us] = await withTimeout(
    Promise.all([
      supabase
        .from('line_items')
        .select('*')
        .order('level_order', { ascending: true })
        .order('item_order', { ascending: true }),
      supabase.from('app_constants').select('key, value'),
      supabase
        .from('scenarios')
        .select('id, name, snapshot, version, created_at, updated_at'),
      supabase.from('user_state').select('*').maybeSingle(),
    ]),
    15_000,
  )

  if (li.error) throw new Error(`Failed to load line items: ${li.error.message}`)
  if (ac.error) throw new Error(`Failed to load constants: ${ac.error.message}`)
  if (sc.error) throw new Error(`Failed to load scenarios: ${sc.error.message}`)
  if (us.error) throw new Error(`Failed to load user state: ${us.error.message}`)

  const constantsByKey = new Map((ac.data ?? []).map((r) => [r.key as string, r.value]))
  for (const key of CONSTANT_KEYS) {
    if (!constantsByKey.has(key)) {
      throw new Error(`reference data is incomplete — app_constants is missing '${key}'`)
    }
  }
  const meta = constantsByKey.get('meta') as LineItemData['meta']
  const constants: AppConstants = {
    guardrail_capacity: constantsByKey.get('guardrail_capacity') as AppConstants['guardrail_capacity'],
    season_windows: constantsByKey.get('season_windows') as AppConstants['season_windows'],
    escalation_default_rates: constantsByKey.get(
      'escalation_default_rates',
    ) as AppConstants['escalation_default_rates'],
    public_funding_caps: constantsByKey.get('public_funding_caps') as AppConstants['public_funding_caps'],
    startup_audit_band: constantsByKey.get('startup_audit_band') as AppConstants['startup_audit_band'],
    sequence_captions: constantsByKey.get('sequence_captions') as AppConstants['sequence_captions'],
  }

  const data = assembleCatalog((li.data ?? []) as LineItemRow[], meta)

  const scenarioRows = (sc.data ?? []) as ScenarioRow[]
  const workingRow = scenarioRows.find((r) => r.id === 'working') ?? null
  const savedRows = scenarioRows.filter((r) => r.id !== 'working')
  const userState = us.data as {
    active_scenario_id: string
    compare_scenario_id: string | null
    funding_overrides: unknown
    labor_fractions: unknown
    labor_globals: unknown
    participation: unknown
    import_resolved: boolean
  } | null

  // First-ever login: nothing remote → null (the store boots seeded).
  const hasRemote = userState !== null || workingRow !== null || savedRows.length > 0
  const rawPersisted: unknown = hasRemote
    ? {
        version: 1,
        activeScenarioId: userState?.active_scenario_id ?? 'baseline',
        compareScenarioId: userState?.compare_scenario_id ?? null,
        scenarios: savedRows.map((r) => ({
          id: r.id,
          name: r.name,
          createdAt: Date.parse(r.created_at),
          updatedAt: Date.parse(r.updated_at),
          snapshot: r.snapshot,
        })),
        working: workingRow?.snapshot,
        fundingOverrides: userState?.funding_overrides ?? {},
        laborFractions: userState?.labor_fractions ?? {},
        laborGlobals: userState?.labor_globals ?? {},
        participation: userState?.participation ?? {},
      }
    : null

  const session: HydratedSession = {
    userId: user.id,
    email: user.email ?? null,
    rawPersisted,
    pendingImport: null, // set by Boot after the import offer resolves
    workingRowExists: workingRow !== null,
    workingRowVersion: workingRow?.version ?? 0,
    userStateRowExists: userState !== null,
    importResolved: userState?.import_resolved ?? false,
  }

  return { data, constants, session }
}

// StrictMode double-fires Boot's effect in dev — memoize the in-flight
// promise so exactly one network burst happens; clear on failure so the
// Retry button re-runs from scratch.
let inflight: Promise<HydrateResult> | null = null

export function hydrate(): Promise<HydrateResult> {
  inflight ??= doHydrate().catch((e: unknown) => {
    inflight = null
    throw e
  })
  return inflight
}
