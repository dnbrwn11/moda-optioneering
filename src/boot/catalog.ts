// The single data boundary between the eager boot chunk and the lazy app
// chunk. Boot authenticates, fetches everything, and calls initCatalog();
// only then is the app chunk imported, so every app module can read the
// catalog synchronously at module-eval time — exactly as they read the
// bundled JSON before the migration.
//
// Boot-chunk isolation rule: files under src/boot/ may import only this
// module, supabaseClient, types, and tokens/CSS — never store.ts,
// lib/scenarios.ts, lib/funding.ts, lib/selectors.ts, or components. Any
// accidental early import of the data layer fails fast on the loud error
// below instead of silently reading undefined.
import type { CatalogData, EscalationRates } from '../types'

export interface AppConstants {
  guardrail_capacity: { offseasonBase: number; duringSeasonBase: number }
  season_windows: {
    offseasonMonths: number
    duringSeasonMonths: number
    offseason: { startMonth: number; endMonth: number }
    duringSeason: { startMonth: number; endMonth: number }
  }
  escalation_default_rates: EscalationRates
  public_funding_caps: {
    caps: { source: string; cap: number; note: string }[]
    totalCap: number
  }
  startup_audit_band: { min: number; max: number }
  sequence_captions: Record<string, string>
}

export interface HydratedSession {
  userId: string
  email: string | null
  // PersistedState-shaped raw payload assembled from the user's remote rows
  // (sanitized by the app chunk exactly where localStorage payloads were),
  // or null on first-ever login.
  rawPersisted: unknown
  // Raw legacy localStorage payload the user chose to import, or null.
  pendingImport: unknown
  workingRowExists: boolean
  workingRowVersion: number // 0 when the working row doesn't exist yet
  userStateRowExists: boolean
  // True once the one-time localStorage import offer has been resolved
  // (either direction) — persisted to user_state by the persistence layer.
  importResolved: boolean
}

export class CatalogNotInitializedError extends Error {
  constructor() {
    super('initCatalog() must run before app modules load')
    this.name = 'CatalogNotInitializedError'
  }
}

let catalogData: CatalogData | null = null
let appConstants: AppConstants | null = null
let session: HydratedSession | null = null

// Idempotent for identical inputs (StrictMode re-runs pass the same memoized
// hydrate result); conflicting re-init is a programming error.
export function initCatalog(
  data: CatalogData,
  constants: AppConstants,
  sess: HydratedSession,
): void {
  if (catalogData !== null) {
    if (catalogData === data && appConstants === constants && session === sess) return
    throw new Error('initCatalog() called twice with different data')
  }
  catalogData = data
  appConstants = constants
  session = sess
}

export function getCatalogData(): CatalogData {
  if (!catalogData) throw new CatalogNotInitializedError()
  return catalogData
}

export function getAppConstants(): AppConstants {
  if (!appConstants) throw new CatalogNotInitializedError()
  return appConstants
}

export function getSession(): HydratedSession {
  if (!session) throw new CatalogNotInitializedError()
  return session
}
