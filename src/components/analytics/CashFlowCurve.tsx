import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Totals } from '../../lib/escalation'
import { cashFlowCurve, KIND_COLORS, monthLabel } from '../../lib/analytics'
import { fmtMillions } from '../../lib/format'
import { color as C } from '../../lib/tokens'

const axisTick = { fontSize: 11, fill: C.inkMuted }
const fmtAxis = (v: number) => `$${Math.round(v / 1e6)}M`

export default function CashFlowCurve({ totals }: { totals: Totals }) {
  const { points, bands, total, ticks } = cashFlowCurve(totals)

  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
          Cumulative Cash Flow
        </h3>
        <span className="text-xs font-medium tabular-nums text-ink">
          Climbs to {fmtMillions(total)}
        </span>
      </div>

      {/* Legend for the shaded season bands. */}
      <div className="mb-3 flex flex-wrap gap-3 text-[11px] font-medium text-ink">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: KIND_COLORS.offseason, opacity: 0.28 }}
            aria-hidden
          />
          Offseason (Jun–Sep)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: KIND_COLORS['during-season'], opacity: 0.28 }}
            aria-hidden
          />
          During-Season (Oct–May)
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke={C.gridline} />
            {/* Season bands shaded behind the line, month-accurate edges. */}
            {bands.map((b, i) => (
              <ReferenceArea
                key={i}
                x1={b.start}
                x2={b.end}
                fill={KIND_COLORS[b.kind]}
                fillOpacity={0.1}
                stroke="none"
              />
            ))}
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, ticks[ticks.length - 1]]}
              ticks={ticks}
              tickFormatter={monthLabel}
              tick={axisTick}
              axisLine={{ stroke: C.line }}
              tickLine={false}
              interval={0}
              angle={-30}
              textAnchor="end"
              height={48}
            />
            <YAxis
              tickFormatter={fmtAxis}
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={48}
            />
            <ReferenceLine y={total} stroke={C.line} strokeDasharray="4 4" />
            <Tooltip
              labelFormatter={(t: number) => monthLabel(t)}
              formatter={(value: number) => [fmtMillions(value), 'Cumulative']}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${C.line}`,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="cum"
              stroke={C.accent}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
