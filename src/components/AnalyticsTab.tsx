import { useMemo } from 'react'
import { useStore } from '../store'
import { useCompareScenario, useScenarioTotals, useTotals } from '../lib/selectors'
import { duringSeasonShare, peakYear } from '../lib/analytics'
import {
  FUNDING_CAPTION,
  FUNDING_CLASSES,
  FUNDING_META,
  fundingTotals,
  spendByYearByFunding,
} from '../lib/funding'
import { applySnapshot } from '../lib/scenarios'
import { fmtMillions, fmtPct } from '../lib/format'
import SpendByYearChart from './analytics/SpendByYearChart'
import SpendByWindowChart from './analytics/SpendByWindowChart'
import SpendByFundingChart from './analytics/SpendByFundingChart'
import FundingContextStrip from './analytics/FundingContextStrip'
import CashFlowCurve from './analytics/CashFlowCurve'
import SensitivityChart from './analytics/SensitivityChart'
import Switch from './Switch'

interface StatProps {
  label: React.ReactNode
  value: React.ReactNode
  sub: React.ReactNode
}

function Stat({ label, value, sub }: StatProps) {
  return (
    <div className="flex flex-col justify-center px-6 py-4">
      <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <span className="mt-1 text-2xl font-bold leading-none text-accent">
        {value}
      </span>
      <span className="mt-1 text-xs font-light text-ink">{sub}</span>
    </div>
  )
}

export default function AnalyticsTab() {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  const fundingLens = useStore((s) => s.fundingLens)
  const setFundingLens = useStore((s) => s.setFundingLens)
  const fundingOverrides = useStore((s) => s.fundingOverrides)
  const totals = useTotals()
  // Compare mode: the comparison scenario's totals overlay the spend-per-year
  // chart as a ghosted outlined series.
  const compare = useCompareScenario()
  const compareTotals = useScenarioTotals(compare)

  const dsShare = duringSeasonShare(totals)
  const peak = peakYear(totals)
  const premium = totals.escalatedTotal - totals.baseTotal
  const premiumPct = totals.baseTotal > 0 ? premium / totals.baseTotal : 0

  // Funding lens derivations — parallel read-only aggregations over the same
  // escalatedCost math; nothing in computeTotals changes.
  const byClass = useMemo(
    () => (fundingLens ? fundingTotals(items, rates, fundingOverrides) : null),
    [fundingLens, items, rates, fundingOverrides],
  )
  const fundingRows = useMemo(
    () => (fundingLens ? spendByYearByFunding(items, rates, fundingOverrides) : null),
    [fundingLens, items, rates, fundingOverrides],
  )
  // Ghost stack: the compare scenario's phases/inclusion/alloc/rates with the
  // same live classification — a true like-for-like re-stack.
  const fundingGhost = useMemo(
    () =>
      fundingLens && compare
        ? spendByYearByFunding(
            applySnapshot(items, compare.snapshot),
            compare.snapshot.rates,
            fundingOverrides,
          )
        : null,
    [fundingLens, compare, items, fundingOverrides],
  )

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      <div className="flex justify-end">
        <Switch label="Funding lens" on={fundingLens} onChange={setFundingLens} />
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-1 divide-y divide-line rounded-lg border border-line bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
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

      {/* Funding lens: escalated $ per class + term-sheet deal context */}
      {fundingLens && byClass && (
        <>
          <div className="grid grid-cols-1 divide-y divide-line rounded-lg border border-line bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {FUNDING_CLASSES.map((cls) => (
              <Stat
                key={cls}
                label={
                  <>
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: FUNDING_META[cls].color }}
                      aria-hidden
                    />
                    {FUNDING_META[cls].label}
                  </>
                }
                value={fmtMillions(byClass[cls])}
                sub={
                  totals.escalatedTotal > 0
                    ? `${fmtPct(byClass[cls] / totals.escalatedTotal)} of escalated total`
                    : '—'
                }
              />
            ))}
          </div>
          <FundingContextStrip />
          <p className="-mt-2 text-[10px] font-light italic text-ink-muted">{FUNDING_CAPTION}</p>
        </>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SpendByWindowChart totals={totals} />
        {fundingLens && fundingRows ? (
          <SpendByFundingChart
            data={fundingRows}
            ghost={fundingGhost}
            compareName={compare?.name ?? null}
          />
        ) : (
          <SpendByYearChart
            totals={totals}
            compareTotals={compareTotals}
            compareName={compare?.name ?? null}
          />
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SensitivityChart items={items} totals={totals} />
        <CashFlowCurve totals={totals} />
      </div>
    </div>
  )
}
