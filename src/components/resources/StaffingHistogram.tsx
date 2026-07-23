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
import { KIND_COLORS } from '../../lib/analytics'
import { chart as CH, color as C } from '../../lib/tokens'

export interface HistogramPoint {
  label: string
  kind: 'offseason' | 'during-season'
  avg: number
}

const axisTick = { fontSize: 11, fill: C.inkMuted }

export default function StaffingHistogram({ data }: { data: HistogramPoint[] }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
          Site Craft Staffing Histogram
        </h3>
        <span className="text-[11px] font-light text-ink-muted">
          avg craft · chronological
        </span>
      </div>

      {/* Season legend — same colors as the Analytics S-curve bands. */}
      <div className="mb-3 flex flex-wrap gap-3 text-[11px] font-medium text-ink">
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: KIND_COLORS.offseason }}
            aria-hidden
          />
          Offseason (surge)
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: KIND_COLORS['during-season'] }}
            aria-hidden
          />
          During-Season (drop)
        </span>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke={C.gridline} />
            <XAxis
              dataKey="label"
              tick={axisTick}
              axisLine={{ stroke: C.line }}
              tickLine={false}
            />
            <YAxis
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={36}
              allowDecimals={false}
              label={{
                value: 'avg craft',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 11, fill: C.inkMuted },
              }}
            />
            <Tooltip
              cursor={{ fill: CH.cursorFill }}
              formatter={(value: number) => [`~${value} craft`, 'Avg on site']}
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${C.line}`,
                fontSize: 12,
              }}
            />
            <Bar dataKey="avg" radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={KIND_COLORS[d.kind]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
