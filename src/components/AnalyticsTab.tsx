import { useStore } from '../store'
import { useCompareScenario, useScenarioTotals, useTotals } from '../lib/selectors'
import { duringSeasonShare, peakYear } from '../lib/analytics'
import { fmtMillions, fmtPct } from '../lib/format'
import SpendByYearChart from './analytics/SpendByYearChart'
import SpendByWindowChart from './analytics/SpendByWindowChart'
import CashFlowCurve from './analytics/CashFlowCurve'
import SensitivityChart from './analytics/SensitivityChart'

interface StatProps {
  label: string
  value: React.ReactNode
  sub: React.ReactNode
}

function Stat({ label, value, sub }: StatProps) {
  return (
    <div className="flex flex-col justify-center px-6 py-4">
      <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
        {label}
      </span>
      <span className="mt-1 text-2xl font-bold leading-none text-pcl-green">
        {value}
      </span>
      <span className="mt-1 text-xs font-light text-pcl-dark">{sub}</span>
    </div>
  )
}

export default function AnalyticsTab() {
  const items = useStore((s) => s.items)
  const totals = useTotals()
  // Compare mode: the comparison scenario's totals overlay the spend-per-year
  // chart as a ghosted outlined series.
  const compare = useCompareScenario()
  const compareTotals = useScenarioTotals(compare)

  const dsShare = duringSeasonShare(totals)
  const peak = peakYear(totals)
  const premium = totals.escalatedTotal - totals.baseTotal
  const premiumPct = totals.baseTotal > 0 ? premium / totals.baseTotal : 0

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      {/* Stat strip */}
      <div className="grid grid-cols-1 divide-y divide-pcl-light rounded-lg border border-pcl-light bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Stat
          label="Spent During-Season"
          value={fmtPct(dsShare)}
          sub="of program in Oct–May windows"
        />
        <Stat
          label="Peak Spend Year"
          value={peak.year}
          sub={`${fmtMillions(peak.amount)} escalated`}
        />
        <Stat
          label="Escalation Premium"
          value={fmtMillions(premium)}
          sub={`+${fmtPct(premiumPct)} vs flat 2025 base`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpendByWindowChart totals={totals} />
        <SpendByYearChart
          totals={totals}
          compareTotals={compareTotals}
          compareName={compare?.name ?? null}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SensitivityChart items={items} totals={totals} />
        <CashFlowCurve totals={totals} />
      </div>
    </div>
  )
}
