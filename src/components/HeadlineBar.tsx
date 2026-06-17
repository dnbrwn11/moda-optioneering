import { useStore } from '../store'
import { useTotals } from '../lib/selectors'
import {
  fmtDeltaMillions,
  fmtDeltaPct,
  fmtFull,
  fmtMillions,
} from '../lib/format'

interface StatProps {
  label: string
  children: React.ReactNode
  sub?: React.ReactNode
  hero?: boolean
}

function Stat({ label, children, sub, hero }: StatProps) {
  return (
    <div className="flex flex-col justify-center px-6 py-4">
      <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
        {label}
      </span>
      <span
        className={
          hero
            ? 'mt-1 font-bold leading-none text-pcl-green'
            : 'mt-1 font-medium leading-none text-pcl-dark'
        }
        style={hero ? { fontSize: '3rem' } : { fontSize: '1.5rem' }}
      >
        {children}
      </span>
      {sub && <span className="mt-1 text-xs font-light text-pcl-dark">{sub}</span>}
    </div>
  )
}

export default function HeadlineBar() {
  const totals = useTotals()
  const baseline = useStore((s) => s.baselineEscalatedTotal)

  const delta = totals.escalatedTotal - baseline
  const deltaPct = baseline ? delta / baseline : 0
  const deltaColor =
    delta > 0 ? 'text-pcl-dark' : delta < 0 ? 'text-pcl-green' : 'text-pcl-mid'

  return (
    <div className="grid grid-cols-2 divide-x divide-pcl-light border-b border-pcl-light bg-white md:grid-cols-5">
      <Stat label="Total Escalated Cost" hero>
        {fmtMillions(totals.escalatedTotal)}
      </Stat>

      <Stat label="Total Base Cost (2025)" sub="reference">
        {fmtMillions(totals.baseTotal)}
      </Stat>

      <Stat label="Δ vs Baseline">
        <span className={deltaColor}>{fmtDeltaMillions(delta)}</span>
        <span className={`ml-2 text-base ${deltaColor}`}>
          {fmtDeltaPct(deltaPct)}
        </span>
      </Stat>

      <Stat
        label="Items Included"
        sub={`of ${totals.totalCount} scope items`}
      >
        {totals.includedCount} / {totals.totalCount}
      </Stat>

      {/* v2 placeholder — Net Seat Impact. Shows "—" for now. */}
      <Stat label="Net Seat Impact" sub="v2 — coming soon">
        <span className="text-pcl-mid">—</span>
      </Stat>

      {/* Baseline reference, tucked small (full $ for the curious). */}
      <div className="col-span-2 hidden">{fmtFull(baseline)}</div>
    </div>
  )
}
