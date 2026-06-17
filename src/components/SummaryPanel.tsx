import { useEffect, useState } from 'react'
import { useTotals } from '../lib/selectors'
import { TIME_PHASES } from '../lib/phases'
import { fmtMillions } from '../lib/format'

type View = 'phase' | 'year'

interface Row {
  key: string
  label: string
  value: number
  // Continuous line gets a lighter, dashed treatment — it isn't a window.
  continuous?: boolean
}

// A single horizontal bar: gray label · PCL-green bar · value.
function BarRow({ row, max }: { row: Row; max: number }) {
  const pct = max > 0 ? Math.max((row.value / max) * 100, row.value > 0 ? 2 : 0) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 truncate text-right text-xs font-medium text-pcl-mid">
        {row.label}
      </span>
      <div className="relative h-5 flex-1 rounded bg-[#f0f0ef]">
        <div
          className={`h-full rounded bg-pcl-green transition-[width] duration-300 ${
            row.continuous ? 'opacity-70' : ''
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums text-pcl-dark">
        {fmtMillions(row.value)}
      </span>
    </div>
  )
}

export default function SummaryPanel() {
  const totals = useTotals()
  const [view, setView] = useState<View>('phase')

  // --- Build rows for each view -------------------------------------------
  const phaseRows: Row[] = [
    ...TIME_PHASES.map((p) => ({
      key: p.id,
      label: p.name,
      value: totals.phaseSubtotals[p.id],
    })),
    {
      key: 'CONT',
      label: 'Continuous / Systems Work',
      value: totals.continuousTotal,
      continuous: true,
    },
  ]

  const yearRows: Row[] = ([2027, 2028, 2029] as const).map((y) => ({
    key: String(y),
    label: String(y),
    value: totals.spendByYear[y],
  }))

  const rows = view === 'phase' ? phaseRows : yearRows
  const max = Math.max(...rows.map((r) => r.value), 1)

  // --- Console reconciliation (live) --------------------------------------
  useEffect(() => {
    const headline = totals.escalatedTotal
    const phaseSum = phaseRows.reduce((s, r) => s + r.value, 0)
    const yearSum = yearRows.reduce((s, r) => s + r.value, 0)
    const M = (v: number) => `$${(v / 1e6).toFixed(2)}M`
    const ok = (v: number) => Math.abs(v - headline) < 1 // sub-dollar tolerance

    /* eslint-disable no-console */
    console.log(
      '%c[Moda Optioneering] summary reconciliation',
      'color:#005D2F;font-weight:700',
    )
    console.log(`Headline Total Escalated Cost: ${M(headline)}`)
    console.log(
      `%cBy Phase: 6 windows + continuous = ${M(phaseSum)}  ${
        ok(phaseSum) ? '✓ reconciles' : '✗ MISMATCH'
      }`,
      `color:${ok(phaseSum) ? '#005D2F' : '#D83C31'};font-weight:700`,
    )
    console.log(
      `%cBy Year:  2027 + 2028 + 2029 = ${M(yearSum)}  ${
        ok(yearSum) ? '✓ reconciles' : '✗ MISMATCH'
      }`,
      `color:${ok(yearSum) ? '#005D2F' : '#D83C31'};font-weight:700`,
    )
    /* eslint-enable no-console */
  }, [totals])

  return (
    <section className="border-b border-pcl-light bg-white px-6 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
          Spend Summary
        </h2>
        {/* Toggle */}
        <div className="inline-flex rounded border border-pcl-light p-0.5">
          {(['phase', 'year'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                view === v
                  ? 'bg-pcl-green text-white'
                  : 'text-pcl-mid hover:text-pcl-dark'
              }`}
            >
              {v === 'phase' ? 'By Phase' : 'By Year'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <BarRow key={row.key} row={row} max={max} />
        ))}
      </div>

      {/* Reconciliation footer + the continuous-spend caveat. */}
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-pcl-light pt-2">
        <p className="text-[11px] font-light text-pcl-mid">
          {view === 'phase'
            ? 'Continuous / systems work spans all phases, so a window can read low or zero discrete scope while systems spend still accrues — it stays on its own line rather than being split into windows we can’t resolve.'
            : 'Each year combines escalated discrete scope mapped to that year plus every continuous item’s per-year allocated, escalated portion.'}
        </p>
        <p className="shrink-0 text-[11px] font-medium tabular-nums text-pcl-dark">
          Sums to {fmtMillions(totals.escalatedTotal)} total escalated
        </p>
      </div>
    </section>
  )
}
