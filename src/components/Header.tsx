// Clean header band: PCL logo (top-left) + project title + live ESC chip
// (right). PCL Green band, calm. Sits above the scroll region so it stays pinned.
import EscalationChip from './EscalationChip'
import { getSession } from '../boot/catalog'
import { signOutAndReload } from '../lib/persistence'

export default function Header() {
  const email = getSession().email

  return (
    <header className="relative z-30 flex items-center gap-6 border-b-4 border-brand-yellow bg-accent px-6 py-3">
      {/* PCL logo — constrained by height, width auto-scales (aspect kept). */}
      <img
        src="/logos/PCL_Construction.svg.png"
        alt="PCL"
        className="h-9 w-auto shrink-0 py-0.5"
      />

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold leading-tight text-white">
          Moda Center — Capital Program Planner
        </h1>
      </div>

      {/* Export PDF — primary action (PCL yellow). Prints the Phasing snapshot. */}
      <button
        type="button"
        onClick={() => window.print()}
        className="flex shrink-0 items-center gap-1.5 rounded bg-brand-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink shadow-sm transition-transform hover:-translate-y-px active:translate-y-0"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6V2.5h8V6M4 12H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1M4 10h8v3.5H4z" />
        </svg>
        Export PDF
      </button>

      <EscalationChip />

      {/* Signed-in identity + sign-out (secondary treatment vs Export PDF). */}
      {email ? (
        <span className="hidden max-w-[18ch] shrink truncate text-xs text-white/70 lg:block" title={email}>
          {email}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => void signOutAndReload()}
        className="shrink-0 rounded border border-white/30 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/10"
      >
        Sign out
      </button>
    </header>
  )
}
