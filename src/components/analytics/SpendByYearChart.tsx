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
import { chart as CH, color as C } from '../../lib/tokens'

const axisTick = { fontSize: 11, fill: C.inkMuted }
const fmtAxis = (v: number) => `$${Math.round(v / 1e6)}M`

export default function SpendByYearChart({
  totals,
  compareTotals = null,
  compareName = null,
}: {
  totals: Totals
  compareTotals?: Totals | null
  compareName?: string | null
}) {
  const [hidden, setHidden] = useState<Set<SeriesKey>>(new Set())
  const data = spendByYearByKind(totals)
  const visible = SERIES.filter((s) => !hidden.has(s.key))

  // Compare mode: merge the comparison scenario's per-year stacks into the
  // same rows under `cmp:*` keys — rendered as a second, outlined stack.
  const ghost = compareTotals ? spendByYearByKind(compareTotals) : null
  const rows: Record<string, number | string>[] = ghost
    ? data.map((d, i) => ({
        ...d,
        ...Object.fromEntries(SERIES.map((s) => [`cmp:${s.key}`, ghost[i][s.key]])),
      }))
    : data.map((d) => ({ ...d }))

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
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
          Spend per Year by Phase
        </h3>
        <span className="text-xs font-medium tabular-nums text-ink">
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
                  ? 'border-line text-ink-muted'
                  : 'border-line text-ink hover:bg-accent/5'
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: off ? C.line : s.color }}
                aria-hidden
              />
              {s.label}
            </button>
          )
        })}
        {ghost && (
          <span className="flex items-center gap-1.5 px-1 py-1 text-[11px] font-light italic text-ink-muted">
            <span
              className="h-2.5 w-2.5 rounded-sm border border-dashed border-ink-muted"
              aria-hidden
            />
            outlined: {compareName ?? 'comparison'}
          </span>
        )}
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke={C.gridline} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              axisLine={{ stroke: C.line }}
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
              cursor={{ fill: CH.cursorFill }}
              formatter={(value: number, name: string) => [fmtMillions(value), name]}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${C.line}`,
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
            {/* Ghosted comparison stack — transparent fill, dashed outline. */}
            {ghost &&
              SERIES.map((s) => (
                <Bar
                  key={`cmp:${s.key}`}
                  dataKey={`cmp:${s.key}`}
                  name={`${s.label} (${compareName ?? 'comparison'})`}
                  stackId="compare"
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth={1.2}
                  strokeDasharray="4 3"
                  hide={hidden.has(s.key)}
                  isAnimationActive={false}
                />
              ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex justify-around border-t border-line pt-2">
        {perYearVisible.map((d) => (
          <div key={d.year} className="flex flex-col items-center">
            <span className="text-[10px] font-medium uppercase tracking-wider text-ink-muted">
              {d.year}
            </span>
            <span className="text-xs font-bold tabular-nums text-ink">
              {fmtMillions(d.total)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
