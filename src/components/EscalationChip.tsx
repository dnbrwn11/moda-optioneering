import { useState } from 'react'
import { useStore, DEFAULT_RATES } from '../store'
import { ESCALATION_YEARS } from '../lib/phases'
import { fmtPct } from '../lib/format'
import type { EscalationRates, Year } from '../types'

// Compact one-line rate readout, e.g. "5.0 / 5.0 / 5.0 / 5.0%".
function ratesLine(rates: EscalationRates): string {
  return `${ESCALATION_YEARS.map((y) => (rates[y] * 100).toFixed(1)).join(' / ')}%`
}

const SLIDER_MIN = 0
const SLIDER_MAX = 0.1 // 10%
const SLIDER_STEP = 0.005 // 0.5%

function YearSlider({ year }: { year: Year }) {
  const rate = useStore((s) => s.rates[year])
  const setRate = useStore((s) => s.setRate)
  const offDefault = Math.abs(rate - DEFAULT_RATES[year]) > 1e-9

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-pcl-dark">
          {year}
        </span>
        <span
          className={`text-base font-bold tabular-nums ${
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

// ESC chip lives in the dark-green header. The chip always shows the live rates;
// clicking opens a popover with the per-year sliders, footnote, and reset.
export default function EscalationChip() {
  const rates = useStore((s) => s.rates)
  const resetRates = useStore((s) => s.resetRates)
  const [open, setOpen] = useState(false)

  const allDefault = ESCALATION_YEARS.every(
    (y) => Math.abs(rates[y] - DEFAULT_RATES[y]) < 1e-9,
  )

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Escalation rates"
        className="flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs font-bold tabular-nums text-white transition-colors hover:bg-white/20"
      >
        <span className="uppercase tracking-wider text-pcl-yellow">ESC ·</span>
        <span>{ratesLine(rates)}</span>
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.5 4.5 L6 8 L9.5 4.5" />
        </svg>
      </button>

      {open && (
        <>
          {/* Click-away backdrop. */}
          <div
            className="fixed inset-0 z-40"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-lg border border-pcl-light bg-white p-4 text-pcl-dark shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
                Escalation · per-year rate
              </h2>
              <button
                type="button"
                onClick={resetRates}
                disabled={allDefault}
                className="rounded border border-pcl-green px-2.5 py-1 text-xs font-medium text-pcl-green transition-colors hover:bg-pcl-green hover:text-white disabled:cursor-default disabled:border-pcl-light disabled:text-pcl-mid disabled:hover:bg-transparent disabled:hover:text-pcl-mid"
              >
                Reset to 5%
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {ESCALATION_YEARS.map((y) => (
                <YearSlider key={y} year={y} />
              ))}
            </div>
            <p className="mt-3 text-[11px] font-light text-pcl-mid">
              Compounds from 2025. Dial each year independently to scale
              escalation between years — every affected item and the headline
              update live.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
