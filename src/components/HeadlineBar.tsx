import { useCompareScenario, useScenarioTotals, useTotals } from '../lib/selectors'
import { BASELINE_TOTALS } from '../lib/scenarios'
import { fmtDeltaMillions, fmtDeltaPct, fmtMillions } from '../lib/format'

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
  // Δ reference: the compare target when Compare is on, Baseline otherwise.
  const compare = useCompareScenario()
  const compareTotals = useScenarioTotals(compare)
  const refTotals = compareTotals ?? BASELINE_TOTALS

  const delta = totals.escalatedTotal - refTotals.escalatedTotal
  const deltaPct = refTotals.escalatedTotal ? delta / refTotals.escalatedTotal : 0
  const deltaColor =
    delta > 0 ? 'text-pcl-dark' : delta < 0 ? 'text-pcl-green' : 'text-pcl-mid'

  // Per-year spend deltas — only shown while comparing.
  const perYearDeltas = compare
    ? ([2027, 2028, 2029] as const).map((y) => ({
        year: y,
        delta: totals.spendByYear[y] - refTotals.spendByYear[y],
      }))
    : null

  return (
    <div className="grid grid-cols-2 divide-x divide-pcl-light border-b border-pcl-light bg-white md:grid-cols-4">
      <Stat label="Total Escalated Cost" hero>
        {fmtMillions(totals.escalatedTotal)}
      </Stat>

      <Stat label="Total Base Cost (2025)" sub="reference">
        {fmtMillions(totals.baseTotal)}
      </Stat>

      <Stat
        label={compare ? `Δ vs ${compare.name}` : 'Δ vs Baseline'}
        sub={
          perYearDeltas && (
            <span className="tabular-nums">
              {perYearDeltas.map((d, i) => (
                <span key={d.year}>
                  {i > 0 && ' · '}
                  ’{String(d.year).slice(2)}{' '}
                  <span
                    className={
                      d.delta > 0 ? 'text-pcl-dark' : d.delta < 0 ? 'text-pcl-green' : 'text-pcl-mid'
                    }
                  >
                    {fmtDeltaMillions(d.delta)}
                  </span>
                </span>
              ))}
            </span>
          )
        }
      >
        <span className={deltaColor}>{fmtDeltaMillions(delta)}</span>
        <span className={`ml-2 text-base ${deltaColor}`}>
          {fmtDeltaPct(deltaPct)}
        </span>
      </Stat>

      <Stat label="Items Included" sub={`of ${totals.totalCount} scope items`}>
        {totals.includedCount} / {totals.totalCount}
      </Stat>
    </div>
  )
}
