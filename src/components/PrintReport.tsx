import { useStore } from '../store'
import { useTotals } from '../lib/selectors'
import { BASELINE_TOTALS } from '../lib/scenarios'
import { escalatedCost } from '../lib/escalation'
import { PHASES, TIME_PHASES, ESCALATION_YEARS } from '../lib/phases'
import { LEVEL_ACCENT } from '../lib/levels'
import { TRADE_SHORT } from '../lib/trades'
import {
  fmtMillions,
  fmtFull,
  fmtPct,
  fmtDeltaMillions,
  fmtDeltaPct,
} from '../lib/format'
import { color as C, printColors as P } from '../lib/tokens'

// Print accent — reads the token authority (brand accent).
const GREEN = C.accent

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="avoid-break border border-print-border px-3 py-2">
      <div className="text-[8px] font-medium uppercase tracking-wider text-print-label">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold leading-none" style={{ color: GREEN }}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[9px] text-print-secondary">{sub}</div>}
    </div>
  )
}

// Screen-hidden report revealed only under @media print (see index.css).
// Rebuilds the current state as a clean, footing report.
export default function PrintReport() {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  // Print always deltas against Baseline (a program constant), regardless of
  // any on-screen Compare selection — the report is a stable artifact.
  const baseline = BASELINE_TOTALS.escalatedTotal
  const totals = useTotals()

  const delta = totals.escalatedTotal - baseline
  const deltaPct = baseline ? delta / baseline : 0
  const printedOn = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // By Phase (6 windows, continuous folded in straight-line) + By Year figures.
  const byPhase = TIME_PHASES.map((p) => ({
    label: p.name,
    value: totals.phaseWithContinuous[p.id],
  }))
  const byPhaseMax = Math.max(...byPhase.map((r) => r.value), 1)
  const byYear = ([2027, 2028, 2029] as const).map((y) => ({
    year: y,
    value: totals.spendByYear[y],
  }))

  // Phase board table — every phase (incl. Continuous) with its included items,
  // subtotal per phase; grand total foots to the escalated headline.
  const groups = PHASES.map((p) => {
    const its = items.filter((it) => it.phase === p.id && it.included)
    const subtotal = its.reduce((s, it) => s + escalatedCost(it, rates), 0)
    return { phase: p, items: its, subtotal }
  }).filter((g) => g.items.length > 0)
  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0)
  const excludedCount = totals.totalCount - totals.includedCount

  return (
    <div className="print-report hidden bg-white p-0 text-print-body">
      {/* Report header */}
      <div className="avoid-break flex items-end justify-between border-b-2 pb-2" style={{ borderColor: GREEN }}>
        <div>
          <h1 className="text-xl font-bold" style={{ color: GREEN }}>
            Moda Center — Capital Program Planner
          </h1>
          <p className="text-[10px] text-print-label">
            CM/GC Interview Demo · Live cost &amp; phase modeling · Confidential
          </p>
        </div>
        <div className="text-right text-[10px] text-print-label">
          <div className="font-medium">Phasing snapshot</div>
          <div>{printedOn}</div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="avoid-break mt-3 grid grid-cols-4 gap-2">
        <KpiCard label="Total Escalated Cost" value={fmtMillions(totals.escalatedTotal)} />
        <KpiCard label="Total Base Cost (2025)" value={fmtMillions(totals.baseTotal)} sub="reference" />
        <KpiCard
          label="Δ vs Baseline"
          value={`${fmtDeltaMillions(delta)} · ${fmtDeltaPct(deltaPct)}`}
        />
        <KpiCard
          label="Items Included"
          value={`${totals.includedCount} / ${totals.totalCount}`}
          sub="of scope items"
        />
      </div>

      {/* Escalation rates */}
      <div className="avoid-break mt-3">
        <h2 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GREEN }}>
          Escalation · per-year rate (compounds from 2025)
        </h2>
        <div className="mt-1 flex gap-6">
          {ESCALATION_YEARS.map((y) => (
            <div key={y} className="text-[11px]">
              <span className="font-medium text-print-label">{y}: </span>
              <span className="font-bold tabular-nums">{fmtPct(rates[y])}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Spend Summary */}
      <div className="avoid-break mt-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GREEN }}>
          Spend Summary
        </h2>
        <div className="mt-1 grid grid-cols-2 gap-6">
          {/* By Phase — bars */}
          <div>
            <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-print-label">
              By Phase (continuous folded in)
            </div>
            <div className="flex flex-col gap-1">
              {byPhase.map((r) => (
                <div key={r.label} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-right text-[9px] text-print-secondary">
                    {r.label}
                  </span>
                  <span className="relative h-3 flex-1 border border-print-border">
                    <span
                      className="absolute left-0 top-0 h-full"
                      style={{
                        width: `${Math.max((r.value / byPhaseMax) * 100, 1)}%`,
                        backgroundColor: GREEN,
                      }}
                    />
                  </span>
                  <span className="w-12 shrink-0 text-right text-[9px] font-bold tabular-nums">
                    {fmtMillions(r.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* By Year — figures */}
          <div>
            <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-print-label">
              By Year
            </div>
            <div className="flex gap-4">
              {byYear.map((r) => (
                <div key={r.year} className="border border-print-border px-3 py-1.5">
                  <div className="text-[9px] font-medium uppercase tracking-wider text-print-label">
                    {r.year}
                  </div>
                  <div className="text-sm font-bold tabular-nums" style={{ color: GREEN }}>
                    {fmtMillions(r.value)}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[8px] leading-snug text-print-fine">
              Each year combines escalated discrete scope mapped to that year plus
              every continuous item&apos;s per-year allocated, escalated portion.
            </p>
          </div>
        </div>
      </div>

      {/* Phase board table */}
      <div className="mt-4">
        <h2 className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GREEN }}>
          Phase Board · scope detail
        </h2>
        <div className="mt-1 flex flex-col gap-2">
          {groups.map((g) => (
            <table key={g.phase.id} className="avoid-break w-full border-collapse text-[9px]">
              <thead>
                <tr style={{ backgroundColor: P.headerTint }}>
                  <th
                    colSpan={2}
                    className="border border-print-border px-2 py-1 text-left font-bold"
                    style={{ color: GREEN }}
                  >
                    {g.phase.name}
                    <span className="ml-2 font-normal text-print-label">
                      {g.phase.year === null ? '2027–29' : g.phase.year} ·{' '}
                      {g.items.length} items
                    </span>
                  </th>
                  <th className="border border-print-border px-2 py-1 text-right font-bold tabular-nums" style={{ color: GREEN }}>
                    {fmtMillions(g.subtotal)}
                  </th>
                </tr>
                <tr className="text-[8px] uppercase tracking-wide text-print-fine">
                  <th className="border border-print-cell px-2 py-0.5 text-left font-medium">
                    Level · Trade
                  </th>
                  <th className="border border-print-cell px-2 py-0.5 text-left font-medium">
                    Scope
                  </th>
                  <th className="border border-print-cell px-2 py-0.5 text-right font-medium">
                    Escalated
                  </th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((it) => (
                  <tr key={it.id} className="avoid-break">
                    {/* Level coding carried by left border + solid chip (row
                        background stays white; text label keeps it legible in
                        grayscale). print-color-adjust: exact preserves fills. */}
                    <td
                      className="border border-print-cell px-2 py-0.5 align-top whitespace-nowrap"
                      style={{ borderLeft: `3px solid ${LEVEL_ACCENT[it.level]}` }}
                    >
                      <span
                        className="rounded px-1 py-px text-[8px] font-bold text-white"
                        style={{ backgroundColor: LEVEL_ACCENT[it.level] }}
                      >
                        {it.level}
                      </span>
                      <span className="text-print-fine"> · {TRADE_SHORT[it.trade]}</span>
                    </td>
                    <td className="border border-print-cell px-2 py-0.5 align-top">
                      {it.name}
                    </td>
                    <td className="border border-print-cell px-2 py-0.5 text-right align-top tabular-nums">
                      {fmtFull(escalatedCost(it, rates))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>

        {/* Grand total */}
        <div
          className="avoid-break mt-2 flex items-center justify-between border-t-2 px-2 py-1.5"
          style={{ borderColor: GREEN }}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: GREEN }}>
            Total Escalated Cost
            {excludedCount > 0 && (
              <span className="ml-2 text-[9px] font-normal normal-case text-print-fine">
                {excludedCount} scope item{excludedCount === 1 ? '' : 's'} excluded
              </span>
            )}
          </span>
          <span className="text-base font-bold tabular-nums" style={{ color: GREEN }}>
            {fmtMillions(grandTotal)}
          </span>
        </div>
      </div>

      {/* Repeating page footer — Confidential marking. */}
      <div className="print-footer">
        Moda Center — Capital Program Planner · Confidential · {printedOn}
      </div>
    </div>
  )
}
