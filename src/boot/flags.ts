// Shared sessionStorage/localStorage key names used across the boot chunk and
// the persistence layer (sign-out intent vs. session-expiry, legacy payload).
export const SESSION_EXPIRED_FLAG = 'moda-optioneering:session-expired'
export const SIGNOUT_INTENT_FLAG = 'moda-optioneering:signout-intent'

// Pre-migration localStorage persistence keys — read once for the one-time
// import offer, then cleared forever.
export const LEGACY_STORAGE_KEY = 'moda-optioneering:scenarios'
export const LEGACY_BACKUP_KEY = `${LEGACY_STORAGE_KEY}.backup`

export function markSignOutIntent(): void {
  try {
    sessionStorage.setItem(SIGNOUT_INTENT_FLAG, '1')
  } catch {
    // storage unavailable — the worst case is a spurious "session expired" note
  }
}
