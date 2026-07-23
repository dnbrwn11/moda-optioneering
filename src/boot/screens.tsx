// Boot-phase screens — the app's first loading/error patterns. Styled with
// the app tokens (light surface, PCL green band, brand-yellow action) so the
// transition into the app shell feels continuous. Never a blank page: every
// boot state renders one of these or the sign-in gate.
import type { ReactNode } from 'react'

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-[#f4f4f3] px-6">
      <div className="rounded bg-accent px-6 py-3 shadow-sm">
        <img src="/logos/PCL_Construction.svg.png" alt="PCL" className="h-9 w-auto" />
      </div>
      {children}
    </div>
  )
}

export function LoadingScreen({ label = 'Loading program data…' }: { label?: string }) {
  return (
    <Shell>
      <div className="text-sm font-medium uppercase tracking-wider text-ink-muted">{label}</div>
      <div className="h-1 w-56 overflow-hidden rounded-full bg-line">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-accent" />
      </div>
    </Shell>
  )
}

export function ErrorScreen({
  message,
  onRetry,
  onSignOut,
}: {
  message: string
  onRetry: () => void
  onSignOut: () => void
}) {
  return (
    <Shell>
      <div className="max-w-md text-center">
        <div className="text-lg font-bold text-ink">Couldn’t load program data</div>
        <div className="mt-2 text-sm text-ink-muted">{message}</div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded bg-brand-yellow px-4 py-2 text-xs font-bold uppercase tracking-wider text-ink shadow-sm transition-transform hover:-translate-y-px active:translate-y-0"
      >
        Retry
      </button>
      <button
        type="button"
        onClick={onSignOut}
        className="text-xs font-medium text-ink-muted underline hover:text-ink"
      >
        Sign out
      </button>
    </Shell>
  )
}

export function ConfigScreen({ message }: { message: string }) {
  return (
    <Shell>
      <div className="max-w-lg text-center">
        <div className="text-lg font-bold text-ink">Configuration error</div>
        <div className="mt-2 font-mono text-xs leading-relaxed text-ink-muted">{message}</div>
      </div>
    </Shell>
  )
}
