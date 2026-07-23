import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useStore } from '../../store'
import {
  averageRatePct,
  premiumPerPoint,
  sensitivityCurve,
} from '../../lib/analytics'
import type { Item } from '../../types'
import type { Totals } from '../../lib/escalation'
import { fmtMillions } from '../../lib/format'
import { color as C, kindContinuous as KC } from '../../lib/tokens'

const axisTick = { fontSize: 11, fill: C.inkMuted }
const fmtAxis = (v: number) => `$${Math.round(v / 1e6)}M`

export default function SensitivityChart({
  items,
  totals,
}: {
  items: Item[]
  totals: Totals
}) {
  const rates = useStore((s) => s.rates)
  const curve = sensitivityCurve(items)
  const perPoint = premiumPerPoint(curve)
  const currentRatePct = averageRatePct(rates)
  const currentTotal = totals.escalatedTotal

  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
          Escalation Sensitivity
        </h3>
        <span className="text-xs font-medium tabular-nums text-ink">
          Now {fmtMillions(currentTotal)}
        </span>
      </div>
      <p className="mb-3 text-[11px] font-light text-ink-muted">
        Program total at a flat annual rate applied to every year.{' '}
        <span className="font-medium text-ink">
          +1%/yr ≈ {fmtMillions(perPoint)}
        </span>
      </p>

      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart
            data={curve}
            margin={{ top: 8, right: 12, bottom: 4, left: 4 }}
          >
            <CartesianGrid vertical={false} stroke={C.gridline} />
            <XAxis
              dataKey="ratePct"
              type="number"
              domain={[0, 7.5]}
              ticks={curve.map((c) => c.ratePct)}
              tickFormatter={(v: number) => `${v}%`}
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
              domain={['dataMin', 'dataMax']}
            />
            {/* Current position markers. */}
            <ReferenceLine
              y={currentTotal}
              stroke={KC}
              strokeDasharray="4 4"
            />
            <ReferenceLine
              x={currentRatePct}
              stroke={KC}
              strokeDasharray="4 4"
            />
            <ReferenceDot
              x={currentRatePct}
              y={currentTotal}
              r={5}
              fill={KC}
              stroke="#fff"
              strokeWidth={2}
              label={{
                value: 'current',
                position: 'top',
                fontSize: 11,
                fill: KC,
              }}
            />
            <Tooltip
              labelFormatter={(v: number) => `Flat ${v}%/yr`}
              formatter={(value: number) => [fmtMillions(value), 'Program total']}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${C.line}`,
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke={C.accent}
              strokeWidth={2}
              dot={{ r: 3, fill: C.accent }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
