import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Totals } from '../../lib/escalation'
import { SERIES, spendByYearByKind } from '../../lib/analytics'
import type { SeriesKey } from '../../lib/analytics'
import { fmtMillions } from '../../lib/format'

const axisTick = { fontSize: 11, fill: '#A6A6A6' }
const fmtAxis = (v: number) => `$${Math.round(v / 1e6)}M`

export default function SpendByYearChart({ totals }: { totals: Totals }) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set())
  const data = spendByYearByKind(totals)
  const visible = SERIES.filter((s) => !hidden.has(s.key))

  function toggle(key: SeriesKey) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Visible totals recompute as series toggle on/off.
  const perYearVisible = data.map((d) => ({
    year: d.year,
    total: visible.reduce((s, ser) => s + d[ser.key], 0),
  }))
  const grandVisible = perYearVisible.reduce((s, d) => s + d.total, 0)

  return (
    <section className="rounded-lg border border-pcl-light bg-white p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
          Spend per Year by Phase
        </h3>
        <span className="text-xs font-medium tabular-nums text-pcl-dark">
          Visible: {fmtMillions(grandVisible)}
        </span>
      </div>

      {/* Clickable legend — toggles each series on/off. */}
      <div className="mb-3 flex flex-wrap gap-2">
        {SERIES.map((s) => {
          const off = hidden.has(s.key)
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              aria-pressed={!off}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                off
                  ? 'border-pcl-light text-pcl-mid'
                  : 'border-pcl-light text-pcl-dark hover:bg-pcl-green/5'
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: off ? '#CFCFCF' : s.color }}
                aria-hidden
              />
              {s.label}
            </button>
          )
        })}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke="#ececeb" />
            <XAxis
              dataKey="label"
              tick={axisTick}
              axisLine={{ stroke: '#CFCFCF' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtAxis}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <Tooltip
              cursor={{ fill: 'rgba(0,93,47,0.06)' }}
              formatter={(value: number, name: string) => [fmtMillions(value), name]}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #CFCFCF',
                fontSize: 12,
              }}
            />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="spend"
                fill={s.color}
                hide={hidden.has(s.key)}
                radius={s.key === 'continuous' ? [3, 3, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex justify-around border-t border-pcl-light pt-2">
        {perYearVisible.map((d) => (
          <div key={d.year} className="flex flex-col items-center">
            <span className="text-[10px] font-medium uppercase tracking-wider text-pcl-mid">
              {d.year}
            </span>
            <span className="text-xs font-bold tabular-nums text-pcl-dark">
              {fmtMillions(d.total)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
