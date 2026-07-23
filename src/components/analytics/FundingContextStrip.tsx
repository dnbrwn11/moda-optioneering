import {
  PUBLIC_FUNDING_CAPS,
  PUBLIC_FUNDING_TOTAL_CAP,
  RENOVATION_BUDGET_NOTE,
  TERM_SHEET_LABEL,
} from '../../lib/funding'

const fmtCap = (v: number) => `≤ $${Math.round(v / 1e6)}M`

// Static term-sheet context for the Funding Lens. Deliberately no visual
// comparison (bar/meter/percentage) against the construction total: the $573M
// Renovation Budget basis (design + soft costs + contingency) differs from this
// tool's construction-cost scope, so a direct comparison would mislead.
export default function FundingContextStrip() {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
          Public Funding Contribution Capacity
        </h3>
        <span className="text-[10px] font-light italic text-ink-muted">{TERM_SHEET_LABEL}</span>
      </div>

      <div className="mt-3 grid grid-cols-1 divide-y divide-line rounded-md border border-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {PUBLIC_FUNDING_CAPS.map((c) => (
          <div key={c.source} className="flex flex-col justify-center px-4 py-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              {c.source}
            </span>
            <span className="mt-1 text-xl font-bold leading-none tabular-nums text-ink">
              {fmtCap(c.cap)}
            </span>
            <span className="mt-1 text-xs font-light text-ink">
              {c.note || 'capacity cap'}
            </span>
          </div>
        ))}
        <div className="flex flex-col justify-center px-4 py-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            Total Public Contribution
          </span>
          <span className="mt-1 text-xl font-bold leading-none tabular-nums text-ink">
            {fmtCap(PUBLIC_FUNDING_TOTAL_CAP)}
          </span>
          <span className="mt-1 text-xs font-light text-ink">City + County + State</span>
        </div>
      </div>

      <p className="mt-2 text-[10px] font-light italic text-ink-muted">{RENOVATION_BUDGET_NOTE}</p>
    </section>
  )
}
