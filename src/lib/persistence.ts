// Supabase-backed persistence — replaces the localStorage writer. One
// debounced choke point (store.ts subscribes the whole store), flushing a
// dirty-diff: saved-scenario rows are written only when they actually change
// (explicit save/rename/delete), the high-frequency stream touches only the
// per-user working row (version-CAS guarded against a second tab) and the
// user_state row (globals + pointers). Nothing writes until initPersistence()
// runs with the hydrated state, so seeded defaults can never clobber a
// remote row.
import { create } from 'zustand'
import {
  getCachedAccessToken,
  getSupabase,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from '../boot/supabaseClient'
import { getSession } from '../boot/catalog'
import { markSignOutIntent } from '../boot/flags'
import type { PersistedState, Scenario, ScenarioSnapshot } from './scenarios'

// ── Save-state surface (chip in ScenarioBar) ───────────────────────────────
// A separate tiny store so save status can never feed back into the main
// store's persistence subscription.
export type SaveStatus = 'saved' | 'saving' | 'error'
interface SaveState {
  status: SaveStatus
  note: string | null
}
export const useSaveState = create<SaveState>(() => ({ status: 'saved', note: null }))
const setSave = (status: SaveStatus, note: string | null = null) =>
  useSaveState.setState({ status, note })

// ── Module state ───────────────────────────────────────────────────────────
const DEBOUNCE_MS = 300
const RETRY_MIN_MS = 2_000
const RETRY_MAX_MS = 30_000

let ready = false
let userId = ''
let importResolved = false
let workingRowExists = false
let workingVersion = 0
let ackedScenarios = new Map<string, string>() // id -> fingerprint of remote content
let ackedWorkingJson: string | null = null
let ackedUserStateJson: string | null = null
let latest: PersistedState | null = null
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryDelay = RETRY_MIN_MS
let flushing = false
let dirtyWhileFlushing = false

const scenarioFingerprint = (s: Scenario): string =>
  JSON.stringify({ name: s.name, updatedAt: s.updatedAt, snapshot: s.snapshot })

function userStateRowFrom(p: PersistedState): Record<string, unknown> {
  return {
    owner: userId,
    active_scenario_id: p.activeScenarioId,
    compare_scenario_id: p.compareScenarioId,
    funding_overrides: p.fundingOverrides,
    labor_fractions: p.laborFractions,
    labor_globals: p.laborGlobals,
    participation: p.participation,
    import_resolved: importResolved,
  }
}

// Arm the writer with the state that is actually in the database, so the
// first flush diffs against remote reality (an accepted localStorage import
// or a first login is "everything dirty" and gets written immediately).
export function initPersistence(remote: PersistedState | null): void {
  const session = getSession()
  userId = session.userId
  importResolved = session.importResolved
  workingRowExists = session.workingRowExists
  workingVersion = session.workingRowVersion
  ackedScenarios = new Map((remote?.scenarios ?? []).map((s) => [s.id, scenarioFingerprint(s)]))
  ackedWorkingJson = session.workingRowExists && remote ? JSON.stringify(remote.working) : null
  ackedUserStateJson =
    session.userStateRowExists && remote ? JSON.stringify(userStateRowFrom(remote)) : null
  ready = true
  window.addEventListener('pagehide', flushKeepalive)
}

export function schedulePersist(payload: PersistedState): void {
  latest = payload
  if (!ready) return
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined
    void flush()
  }, DEBOUNCE_MS)
}

function hasPendingChanges(): boolean {
  return debounceTimer !== undefined || flushing || dirtyWhileFlushing
}

function scheduleRetry(): void {
  clearTimeout(retryTimer)
  retryTimer = setTimeout(() => void flush(), retryDelay)
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS)
}

async function flush(): Promise<void> {
  if (!ready || !latest) return
  if (flushing) {
    dirtyWhileFlushing = true
    return
  }
  flushing = true
  clearTimeout(retryTimer)
  const payload = latest
  let conflictNote: string | null = null
  setSave('saving')
  try {
    const supabase = getSupabase()

    // Saved scenarios: upsert changed, delete removed.
    const fingerprints = new Map(payload.scenarios.map((s) => [s.id, scenarioFingerprint(s)]))
    const changed = payload.scenarios.filter(
      (s) => ackedScenarios.get(s.id) !== fingerprints.get(s.id),
    )
    if (changed.length) {
      const { error } = await supabase.from('scenarios').upsert(
        changed.map((s) => ({ id: s.id, owner: userId, name: s.name, snapshot: s.snapshot })),
        { onConflict: 'owner,id' },
      )
      if (error) throw error
    }
    const removed = [...ackedScenarios.keys()].filter((id) => !fingerprints.has(id))
    if (removed.length) {
      const { error } = await supabase
        .from('scenarios')
        .delete()
        .eq('owner', userId)
        .in('id', removed)
      if (error) throw error
    }
    ackedScenarios = fingerprints

    // Working row (high-frequency path).
    const workingJson = JSON.stringify(payload.working)
    if (workingJson !== ackedWorkingJson) {
      conflictNote = await writeWorking(payload.working)
      ackedWorkingJson = workingJson
    }

    // Globals + pointers.
    const usRow = userStateRowFrom(payload)
    const usJson = JSON.stringify(usRow)
    if (usJson !== ackedUserStateJson) {
      const { error } = await supabase.from('user_state').upsert(usRow, { onConflict: 'owner' })
      if (error) throw error
      ackedUserStateJson = usJson
    }

    retryDelay = RETRY_MIN_MS
    setSave('saved', conflictNote)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    setSave('error', `Not saved — retrying (${message})`)
    scheduleRetry()
  } finally {
    flushing = false
    if (dirtyWhileFlushing) {
      dirtyWhileFlushing = false
      void flush()
    }
  }
}

// Returns a note when another tab's write was overwritten (last-writer-wins).
async function writeWorking(snapshot: ScenarioSnapshot): Promise<string | null> {
  const supabase = getSupabase()
  if (!workingRowExists) {
    const { error } = await supabase
      .from('scenarios')
      .insert({ id: 'working', owner: userId, name: '', snapshot, version: 1 })
    if (error) {
      if (error.code === '23505') {
        // Another tab created it between our fetch and now — adopt and update.
        workingRowExists = true
        workingVersion = await fetchWorkingVersion()
        return writeWorking(snapshot)
      }
      throw error
    }
    workingRowExists = true
    workingVersion = 1
    return null
  }

  // Compare-and-swap on version: a silent 0-row update means another tab won.
  const attempt = async (expected: number) =>
    supabase
      .from('scenarios')
      .update({ snapshot, version: expected + 1 })
      .eq('owner', userId)
      .eq('id', 'working')
      .eq('version', expected)
      .select('version')

  const first = await attempt(workingVersion)
  if (first.error) throw first.error
  if (first.data?.length) {
    workingVersion += 1
    return null
  }

  // CAS miss: row deleted (recreate) or version moved (adopt, then this
  // tab's state wins — single-user tool, no merge UI).
  const remoteVersion = await fetchWorkingVersion()
  if (remoteVersion === 0) {
    workingRowExists = false
    return writeWorking(snapshot)
  }
  workingVersion = remoteVersion
  const second = await attempt(workingVersion)
  if (second.error) throw second.error
  if (!second.data?.length) throw new Error('working-state contention with another tab')
  workingVersion += 1
  return 'Overwrote changes saved from another tab'
}

async function fetchWorkingVersion(): Promise<number> {
  const { data, error } = await getSupabase()
    .from('scenarios')
    .select('version')
    .eq('owner', userId)
    .eq('id', 'working')
    .maybeSingle()
  if (error) throw error
  return data?.version ?? 0
}

// Best-effort working-row flush when the page is being torn down — a
// keepalive REST upsert (supabase-js can't be awaited during pagehide).
// Skips the version CAS; the ≤300ms loss window this covers is tiny.
function flushKeepalive(): void {
  if (!ready || !latest || !hasPendingChanges()) return
  const token = getCachedAccessToken()
  if (!token || !SUPABASE_URL || !SUPABASE_ANON_KEY) return
  try {
    void fetch(`${SUPABASE_URL}/rest/v1/scenarios?on_conflict=owner,id`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([
        {
          id: 'working',
          owner: userId,
          name: '',
          snapshot: latest.working,
          version: workingVersion + 1,
        },
      ]),
    })
  } catch {
    // page is going away — nothing else to do
  }
}

// Header sign-out: final best-effort flush, then a full reload — module-level
// state (catalog refs, the store, this file's closures, React.lazy's module
// cache) makes an in-place teardown fragile, and a reload guarantees zero
// data bleed between users on a shared machine.
export async function signOutAndReload(): Promise<void> {
  markSignOutIntent()
  clearTimeout(debounceTimer)
  debounceTimer = undefined
  try {
    await Promise.race([flush(), new Promise((r) => setTimeout(r, 1_500))])
  } catch {
    // best effort only
  }
  try {
    await getSupabase().auth.signOut()
  } catch {
    // reload regardless — local session is cleared either way
  }
  window.location.reload()
}
