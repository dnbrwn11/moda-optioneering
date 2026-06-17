import { useStore, DEFAULT_RATES } from '../store'
import { ESCALATION_YEARS } from '../lib/phases'
import { fmtPct } from '../lib/format'
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

  const allDefault = ESCALATION_YEARS.every(
    (y) => Math.abs(rates[y] - DEFAULT_RATES[y]) < 1e-9,
  )

  return (
    <section className="border-b border-pcl-light bg-white px-6 py-4">
      {/* Per-year escalated spend now lives in the Spend Summary "By Year" view. */}
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
    </section>
  )
}
