// Supabase client — the only place the two VITE_ env vars are read. Session
// persistence + auto-refresh are supabase-js defaults (localStorage), which
// is exactly what keeps the user signed in across reloads.
import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

export const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY: string | undefined = import.meta.env.VITE_SUPABASE_ANON_KEY

// Developer-facing config problem (missing env), or null when configured.
// Checked by Boot before anything touches the client, so a missing .env
// renders a clear screen instead of a blank page.
export function configError(): string | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return (
      'Missing VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env, fill in both values from the Supabase ' +
      'dashboard, and restart the dev server (or set them in the deploy environment).'
    )
  }
  return null
}

let client: SupabaseClient | null = null
let cachedAccessToken: string | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    const err = configError()
    if (err) throw new Error(err)
    client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
    client.auth.onAuthStateChange((_event, session) => {
      cachedAccessToken = session?.access_token ?? null
    })
  }
  return client
}

// Latest access token, cached synchronously — used by the pagehide keepalive
// flush, which can't await an async getSession().
export function getCachedAccessToken(): string | null {
  return cachedAccessToken
}
