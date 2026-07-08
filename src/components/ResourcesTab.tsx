import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../store'
import { useTotals } from '../lib/selectors'
import { TIME_PHASES } from '../lib/phases'
import { KIND_COLORS } from '../lib/analytics'
import {
  crewCell,
  GLOBAL_DEFAULTS,
  LABOR_FRACTION_DEFAULTS,
  tradeWindowSpend,
} from '../lib/resources'
import type { GlobalAssumptions } from '../lib/resources'
import type { Trade } from '../types'
import { fmtMillions } from '../lib/format'
import StaffingHistogram from './resources/StaffingHistogram'

const ALL_TRADES = Object.keys(LABOR_FRACTION_DEFAULTS) as Trade[]
const AGING: Trade = 'Aging Assets (Owner Decision)'

// --- small editable assumption input -------------------------------------
function NumInput({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  prefix,
  suffix,
  width = 'w-14',
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  prefix?: string
  suffix?: string
  width?: string
}) {
  return (
    <span className="inline-flex items-baseline gap-1 rounded border border-pcl-light bg-white px-2 py-1 focus-within:border-pcl-green">
      {prefix && <span className="text-xs font-medium text-pcl-mid">{prefix}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
        className={`${width} bg-transparent text-right text-sm font-bold tabular-nums text-pcl-dark outline-none`}
      />
      {suffix && <span className="text-xs font-medium text-pcl-mid">{suffix}</span>}
    </span>
  )
}

export default function ResourcesTab() {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  const totals = useTotals()

  const [fractions, setFractions] = useState<Record<Trade, number>>({
    ...LABOR_FRACTION_DEFAULTS,
  })
  const [g, setG] = useState<GlobalAssumptions>({ ...GLOBAL_DEFAULTS })

  function reset() {
    setFractions({ ...LABOR_FRACTION_DEFAULTS })
    setG({ ...GLOBAL_DEFAULTS })
  }
  const setGlobal = (k: keyof GlobalAssumptions, v: number) =>
    setG((prev) => ({ ...prev, [k]: v }))

  // --- Engine: escalated spend per trade per window (reuses computeTotals) --
  const spendByTrade = useMemo(() => tradeWindowSpend(items, rates), [items, rates])

  // Per-trade crew cells + total spend, then rows sorted by spend desc (Aging last).
  const rows = useMemo(() => {
    const built = ALL_TRADES.filter((t) => spendByTrade.has(t)).map((trade) => {
      const windows = spendByTrade.get(trade)!
      const totalSpend = TIME_PHASES.reduce((s, p) => s + windows[p.id], 0)
      const cells = TIME_PHASES.map((p) =>
        crewCell(windows[p.id], fractions[trade], p.id, g),
      )
      return { trade, totalSpend, cells }
    })
    return built.sort((a, b) => {
      if (a.trade === AGING) return 1
      if (b.trade === AGING) return -1
      return b.totalSpend - a.totalSpend
    })
  }, [spendByTrade, fractions, g])

  // Footer + histogram column aggregates.
  const cols = TIME_PHASES.map((p, ci) => {
    const sitePeak = rows.reduce((s, r) => s + r.cells[ci].peak, 0)
    const siteAvg = rows.reduce((s, r) => s + r.cells[ci].avg, 0)
    const fieldStaff = Math.ceil(sitePeak / g.fieldStaffDivisor) + g.fieldStaffBase
    return { phase: p, sitePeak, siteAvg, fieldStaff }
  })

  const histdata = cols.map((c) => ({
    label: c.phase.short,
    kind: c.phase.kind as 'offseason' | 'during-season',
    avg: c.siteAvg,
  }))

  // --- Reconciliation: matrix spend must foot to the escalated headline -----
  const matrixSpend = rows.reduce(
    (s, r) => s + r.cells.reduce((cs, _c, ci) => cs + spendByTrade.get(r.trade)![TIME_PHASES[ci].id], 0),
    0,
  )
  const reconciles = Math.abs(matrixSpend - totals.escalatedTotal) < 1

  useEffect(() => {
    /* eslint-disable no-console */
    console.log(
      '%c[Moda Optioneering] resources reconciliation',
      'color:#005D2F;font-weight:700',
    )
    console.log(
      `%cTrade×window escalated spend = ${fmtMillions(matrixSpend)}  ${
        reconciles ? '✓ reconciles' : '✗ MISMATCH'
      } (headline ${fmtMillions(totals.escalatedTotal)})`,
      `color:${reconciles ? '#005D2F' : '#D83C31'};font-weight:700`,
    )
    /* eslint-enable no-console */
  }, [matrixSpend, reconciles, totals.escalatedTotal])

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      {/* 1 · Assumptions panel ------------------------------------------- */}
      <section className="rounded-lg border border-pcl-light bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
              Staffing Assumptions
            </h3>
            <span className="rounded-full bg-pcl-green/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-pcl-green">
              editable
            </span>
          </div>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded border border-pcl-green px-3 py-1 text-xs font-medium text-pcl-green transition-colors hover:bg-pcl-green hover:text-white"
          >
            Reset to defaults
          </button>
        </div>

        {/* Global inputs */}
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
              Blended craft rate
            </span>
            <NumInput
              value={g.blendedRate}
              onChange={(v) => setGlobal('blendedRate', v)}
              step={5}
              min={1}
              prefix="$"
              suffix="/hr"
              width="w-16"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
              Peak factor
            </span>
            <NumInput
              value={g.peakFactor}
              onChange={(v) => setGlobal('peakFactor', v)}
              step={0.1}
              min={1}
              suffix="×"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
              Crew week
            </span>
            <NumInput
              value={g.crewWeekHrs}
              onChange={(v) => setGlobal('crewWeekHrs', v)}
              step={1}
              min={1}
              suffix="hr"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
              Field staff divisor
            </span>
            <NumInput
              value={g.fieldStaffDivisor}
              onChange={(v) => setGlobal('fieldStaffDivisor', v)}
              step={1}
              min={1}
              prefix="÷"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
              Field staff base
            </span>
            <NumInput
              value={g.fieldStaffBase}
              onChange={(v) => setGlobal('fieldStaffBase', v)}
              step={1}
              min={0}
              prefix="+"
            />
          </label>
        </div>

        {/* Labor fraction per trade */}
        <div className="border-t border-pcl-light pt-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
            Labor fraction per trade · share of escalated cost that is field labor
          </p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            {ALL_TRADES.map((trade) => (
              <div key={trade} className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs font-medium text-pcl-dark">
                  {trade}
                </span>
                <NumInput
                  value={fractions[trade]}
                  onChange={(v) =>
                    setFractions((prev) => ({ ...prev, [trade]: v }))
                  }
                  step={0.05}
                  min={0}
                  max={1}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5 · Staffing histogram (headline element) ---------------------- */}
      <StaffingHistogram data={histdata} />

      {/* 3–4 · Crew matrix + footer ------------------------------------- */}
      <section className="rounded-lg border border-pcl-light bg-white p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
            Crew Matrix
          </h3>
          <span
            className={`text-[11px] font-medium tabular-nums ${
              reconciles ? 'text-pcl-mid' : 'text-pcl-orange'
            }`}
          >
            trade spend {reconciles ? 'reconciles to' : '✗ vs'}{' '}
            {fmtMillions(totals.escalatedTotal)}
          </span>
        </div>
        <p className="mb-3 text-[11px] font-light text-pcl-mid">
          Each cell: ~avg / ~peak craft on site. Blank = no crew that window.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-pcl-light">
                <th className="py-2 pr-3 text-left font-medium uppercase tracking-wider text-pcl-mid">
                  Trade
                </th>
                {TIME_PHASES.map((p) => (
                  <th
                    key={p.id}
                    className="px-2 py-2 text-center font-medium text-pcl-dark"
                    style={{ borderTop: `2px solid ${KIND_COLORS[p.kind as 'offseason' | 'during-season']}` }}
                  >
                    {p.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.trade} className="border-b border-pcl-light/60">
                  <td className="py-1.5 pr-3">
                    <span className="font-medium text-pcl-dark">{r.trade}</span>
                    <span className="ml-2 tabular-nums text-pcl-mid">
                      {fmtMillions(r.totalSpend)}
                    </span>
                  </td>
                  {r.cells.map((c, ci) => (
                    <td
                      key={ci}
                      className="px-2 py-1.5 text-center tabular-nums text-pcl-dark"
                    >
                      {c.avg === 0 && c.peak === 0 ? (
                        <span className="text-pcl-light">·</span>
                      ) : (
                        <span>
                          ~{c.avg}
                          <span className="text-pcl-mid"> / </span>~{c.peak}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-pcl-light">
                <td className="py-2 pr-3 text-right font-bold uppercase tracking-wide text-pcl-dark">
                  Site Peak Craft
                </td>
                {cols.map((c) => (
                  <td
                    key={c.phase.id}
                    className="px-2 py-2 text-center font-bold tabular-nums text-pcl-green"
                  >
                    {c.sitePeak > 0 ? `~${c.sitePeak}` : '·'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-2 pr-3 text-right font-bold uppercase tracking-wide text-pcl-dark">
                  PCL Field Staff
                  <span className="ml-1 font-normal normal-case tracking-normal text-pcl-mid">
                    ⌈peak ÷ {g.fieldStaffDivisor}⌉ + {g.fieldStaffBase}
                  </span>
                </td>
                {cols.map((c) => (
                  <td
                    key={c.phase.id}
                    className="px-2 py-2 text-center font-bold tabular-nums text-pcl-dark"
                  >
                    {c.fieldStaff}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* 6 · Footnote (verbatim) ---------------------------------------- */}
      <p className="px-1 text-[11px] font-light italic text-pcl-mid">
        Parametric estimate only — not a CPM or resource-loaded schedule. Labor
        fractions and craft rate are planning assumptions. Headcounts rounded to
        whole people.
      </p>
    </div>
  )
}
