import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Totals } from '../../lib/escalation'
import { KIND_COLORS, spendByWindow } from '../../lib/analytics'
import { fmtMillions } from '../../lib/format'
import { chart as CH, color as C } from '../../lib/tokens'

const axisTick = { fontSize: 11, fill: C.inkMuted }
const fmtAxis = (v: number) => `$${Math.round(v / 1e6)}M`

export default function SpendByWindowChart({ totals }: { totals: Totals }) {
  const data = spendByWindow(totals)
  const total = data.reduce((s, d) => s + d.amount, 0)

  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
          Spend by Window
        </h3>
        <span className="text-xs font-medium tabular-nums text-ink">
          {fmtMillions(total)} total
        </span>
      </div>

      {/* Season legend — same colors as the S-curve bands. */}
      <div className="mb-3 flex flex-wrap gap-3 text-[11px] font-medium text-ink">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: KIND_COLORS.offseason }}
            aria-hidden
          />
          Offseason
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: KIND_COLORS['during-season'] }}
            aria-hidden
          />
          During-Season
        </span>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
          >
            <CartesianGrid horizontal={false} stroke={C.gridline} />
            <XAxis
              type="number"
              tickFormatter={fmtAxis}
              tick={axisTick}
              axisLine={{ stroke: C.line }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ fill: CH.cursorFill }}
              formatter={(value: number) => [fmtMillions(value), 'Escalated']}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${C.line}`,
                fontSize: 12,
              }}
            />
            <Bar dataKey="amount" radius={[0, 3, 3, 0]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.id} fill={KIND_COLORS[d.kind]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
