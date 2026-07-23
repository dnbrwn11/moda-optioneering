// Boot state machine: config check → session check → sign-in gate →
// parallel fetch → (one-time import offer) → initCatalog → lazy app render.
// The entire existing app graph lives behind React.lazy, so its module-eval
// (store creation, Baseline construction) runs only after the catalog is
// initialized — every downstream module keeps its synchronous-data contract.
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { configError, getSupabase } from './supabaseClient'
import { hydrate } from './hydrate'
import type { HydrateResult } from './hydrate'
import { initCatalog } from './catalog'
import {
  LEGACY_BACKUP_KEY,
  LEGACY_STORAGE_KEY,
  markSignOutIntent,
  SESSION_EXPIRED_FLAG,
  SIGNOUT_INTENT_FLAG,
} from './flags'
import { ConfigScreen, ErrorScreen, LoadingScreen } from './screens'
import SignIn from './SignIn'
import ImportOffer from './ImportOffer'

const App = lazy(() => import('../App'))

const MAX_USER_SCENARIOS = 6 // mirrors lib/scenarios.ts (not importable from boot)

interface LegacyPayload {
  raw: unknown
  count: number
}

// Structural parse only — full sanitization happens in the app chunk against
// the fetched catalog (exactly where localStorage payloads were sanitized).
function readLegacyPayload(): LegacyPayload | null {
  try {
    const s = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!s) return null
    const parsed = JSON.parse(s) as { version?: unknown; scenarios?: unknown }
    if (parsed?.version !== 1) return null
    return {
      raw: parsed,
      count: Array.isArray(parsed.scenarios) ? parsed.scenarios.length : 0,
    }
  } catch {
    return null
  }
}

function clearLegacyPayload(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    localStorage.removeItem(LEGACY_BACKUP_KEY)
  } catch {
    // storage unavailable — nothing to clear
  }
}

type Phase =
  | { kind: 'checking' }
  | { kind: 'signedOut'; notice: string | null }
  | { kind: 'fetching' }
  | { kind: 'error'; message: string }
  | { kind: 'importOffer'; result: HydrateResult; legacy: LegacyPayload }
  | { kind: 'ready' }

export default function Boot() {
  const [phase, setPhase] = useState<Phase>({ kind: 'checking' })
  const wasSignedIn = useRef(false)
  const config = configError()

  const finish = useCallback((result: HydrateResult, pendingImport: unknown, hadLegacy: boolean) => {
    clearLegacyPayload()
    result.session.pendingImport = pendingImport
    // Record the decision only when there was something to decide about, so a
    // clean browser's first login doesn't suppress a later offer elsewhere.
    if (hadLegacy) result.session.importResolved = true
    initCatalog(result.data, result.constants, result.session)
    setPhase({ kind: 'ready' })
  }, [])

  const start = useCallback(() => {
    setPhase({ kind: 'fetching' })
    hydrate()
      .then((result) => {
        const legacy = readLegacyPayload()
        if (legacy && !result.session.importResolved) {
          setPhase({ kind: 'importOffer', result, legacy })
        } else {
          finish(result, null, legacy !== null)
        }
      })
      .catch((e: unknown) => {
        setPhase({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
      })
  }, [finish])

  useEffect(() => {
    if (config) return
    const supabase = getSupabase()
    let disposed = false

    supabase.auth.getSession().then(({ data }) => {
      if (disposed) return
      if (data.session) {
        if (!wasSignedIn.current) {
          wasSignedIn.current = true
          start()
        }
      } else {
        let notice: string | null = null
        try {
          if (sessionStorage.getItem(SESSION_EXPIRED_FLAG)) {
            notice = 'Your session expired — sign in again.'
          }
          sessionStorage.removeItem(SESSION_EXPIRED_FLAG)
          sessionStorage.removeItem(SIGNOUT_INTENT_FLAG)
        } catch {
          // storage unavailable
        }
        setPhase({ kind: 'signedOut', notice })
      }
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' && !wasSignedIn.current) {
        wasSignedIn.current = true
        start()
      }
      if (event === 'SIGNED_OUT' && wasSignedIn.current) {
        // Deliberate sign-out (intent flag set) reloads silently; anything
        // else (revoked user, failed refresh) surfaces as session-expired.
        try {
          if (!sessionStorage.getItem(SIGNOUT_INTENT_FLAG)) {
            sessionStorage.setItem(SESSION_EXPIRED_FLAG, '1')
          }
        } catch {
          // storage unavailable
        }
        window.location.reload()
      }
    })

    return () => {
      disposed = true
      sub.subscription.unsubscribe()
    }
  }, [config, start])

  if (config) return <ConfigScreen message={config} />

  switch (phase.kind) {
    case 'checking':
      return <LoadingScreen label="Checking session…" />
    case 'signedOut':
      return <SignIn notice={phase.notice} />
    case 'fetching':
      return <LoadingScreen />
    case 'error':
      return (
        <ErrorScreen
          message={phase.message}
          onRetry={start}
          onSignOut={() => {
            markSignOutIntent()
            void getSupabase().auth.signOut()
          }}
        />
      )
    case 'importOffer': {
      const remoteSaved = Array.isArray(
        (phase.result.session.rawPersisted as { scenarios?: unknown } | null)?.scenarios,
      )
        ? ((phase.result.session.rawPersisted as { scenarios: unknown[] }).scenarios.length)
        : 0
      const skipCount = Math.max(0, remoteSaved + phase.legacy.count - MAX_USER_SCENARIOS)
      return (
        <ImportOffer
          localCount={phase.legacy.count}
          skipCount={skipCount}
          onImport={() => finish(phase.result, phase.legacy.raw, true)}
          onDiscard={() => finish(phase.result, null, true)}
        />
      )
    }
    case 'ready':
      return (
        <Suspense fallback={<LoadingScreen label="Starting the planner…" />}>
          <App />
        </Suspense>
      )
  }
}
