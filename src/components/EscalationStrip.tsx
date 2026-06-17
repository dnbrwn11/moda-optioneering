import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from 'recharts'
import { useStore, DEFAULT_RATES } from '../store'
import { useTotals } from '../lib/selectors'
import { ESCALATION_YEARS } from '../lib/phases'
import { fmtMillions, fmtPct } from '../lib/format'
import type { Year } from '../types'

const SLIDER_MIN = 0
const SLIDER_MAX = 0.1 // 10%
const SLIDER_STEP = 0.005 // 0.5%

function YearSlider({ year }: { year: Year }) {
  const rate = useStore((s) => s.rates[year])
  const setRate = useStore((s) => s.setRate)
  const offDefault = Math.abs(rate - DEFAULT_RATES[year]) > 1e-9

  return (
    <div className="flex min-w-[120px] flex-1 flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-pcl-dark">
          {year}
        </span>
        <span
          className={`text-lg font-bold tabular-nums ${
            offDefault ? 'text-pcl-green' : 'text-pcl-dark'
          }`}
        >
          {fmtPct(rate)}
        </span>
      </div>
      <input
        type="range"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={SLIDER_STEP}
        value={rate}
        onChange={(e) => setRate(year, Number(e.target.value))}
        aria-label={`${year} escalation rate`}
        className="w-full cursor-pointer"
      />
      <div className="flex justify-between text-[10px] font-light text-pcl-mid">
        <span>0%</span>
        <span>10%</span>
      </div>
    </div>
  )
}

export default function EscalationStrip() {
  const resetRates = useStore((s) => s.resetRates)
  const rates = useStore((s) => s.rates)
  const totals = useTotals()

  const allDefault = ESCALATION_YEARS.every(
    (y) => Math.abs(rates[y] - DEFAULT_RATES[y]) < 1e-9,
  )

  // Per-year escalated spend (2027/28/29) — 2026 carries no phase, omit it.
  const spendYears: Year[] = [2027, 2028, 2029]
  const chartData = spendYears.map((y) => ({
    year: String(y),
    spend: totals.spendByYear[y],
  }))

  return (
    <section className="border-b border-pcl-light bg-white px-6 py-4">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
        {/* Sliders */}
        <div className="flex-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
              Escalation · per-year rate
            </h2>
            <button
              type="button"
              onClick={resetRates}
              disabled={allDefault}
              className="rounded border border-pcl-green px-3 py-1 text-xs font-medium text-pcl-green transition-colors hover:bg-pcl-green hover:text-white disabled:cursor-default disabled:border-pcl-light disabled:text-pcl-mid disabled:hover:bg-transparent disabled:hover:text-pcl-mid"
            >
              Reset to 5%
            </button>
          </div>
          <div className="flex gap-5">
            {ESCALATION_YEARS.map((y) => (
              <YearSlider key={y} year={y} />
            ))}
          </div>
          <p className="mt-3 text-[11px] font-light text-pcl-mid">
            Compounds from 2025. Dial each year independently to scale escalation
            between years — every affected item and the headline update live.
          </p>
        </div>

        {/* Per-year escalated spend — re-phasing impact at a glance */}
        <div className="lg:w-72">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-pcl-mid">
            Escalated spend by year
          </h3>
          <div className="h-[110px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
              >
                <XAxis
                  dataKey="year"
                  tick={{ fill: '#36383D', fontSize: 11 }}
                  axisLine={{ stroke: '#CFCFCF' }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(0,93,47,0.06)' }}
                  formatter={(v: number) => [fmtMillions(v), 'Escalated']}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 6,
                    border: '1px solid #CFCFCF',
                  }}
                />
                <Bar dataKey="spend" radius={[3, 3, 0, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.year} fill="#005D2F" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex justify-around text-[11px] font-medium tabular-nums text-pcl-dark">
            {chartData.map((d) => (
              <span key={d.year}>{fmtMillions(d.spend)}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
