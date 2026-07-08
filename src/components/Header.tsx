// Clean header band: PCL logo (top-left) + project title + live ESC chip
// (right). PCL Green band, calm. Sits above the scroll region so it stays pinned.
import EscalationChip from './EscalationChip'

export default function Header() {
  return (
    <header className="relative z-30 flex items-center gap-6 border-b-4 border-pcl-yellow bg-pcl-green px-6 py-3">
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
        <p className="truncate text-xs font-light text-white/80">
          CM/GC Interview Demo · Live cost &amp; phase modeling · Confidential
        </p>
      </div>

      {/* Export PDF — primary action (PCL yellow). Prints the Phasing snapshot. */}
      <button
        type="button"
        onClick={() => window.print()}
        className="flex shrink-0 items-center gap-1.5 rounded bg-pcl-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-pcl-dark shadow-sm transition-transform hover:-translate-y-px active:translate-y-0"
      >
        <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6V2.5h8V6M4 12H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-1M4 10h8v3.5H4z" />
        </svg>
        Export PDF
      </button>

      <EscalationChip />
    </header>
  )
}
