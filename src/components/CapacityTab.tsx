import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { DEFAULT_CAPACITY } from '../lib/guardrail'
import type { CapacityConfig } from '../lib/guardrail'
import {
  capacityState,
  DEFAULT_WORKDAYS,
  windowCapacityRows,
  WORKDAYS_COMP,
} from '../lib/capacity'
import type { CapacityState, WindowCapacity } from '../lib/capacity'
import { fmtMillions, fmtPct } from '../lib/format'

// --- small formatters ----------------------------------------------------
function fmtPerDay(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`
  return `$${Math.round(v)}`
}

const STATE_STYLE: Record<
  CapacityState,
  { fill: string; text: string; label: string }
> = {
  headroom: { fill: '#005D2F', text: 'text-pcl-green', label: 'Headroom' },
  near: { fill: '#FFC425', text: 'text-[#8a6d0b]', label: 'Near capacity' },
  over: { fill: '#D83C31', text: 'text-pcl-orange', label: 'Over ceiling' },
}

// --- editable planning-assumption input ----------------------------------
function AssumptionInput({
  label,
  value,
  suffix,
  onChange,
  step = 1,
  min = 0,
}: {
  label: string
  value: number
  suffix: string
  onChange: (v: number) => void
  step?: number
  min?: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
        {label}
      </span>
      <span className="flex items-baseline gap-1 rounded border border-pcl-light bg-white px-2 py-1.5 focus-within:border-pcl-green">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) onChange(n)
          }}
          className="w-16 bg-transparent text-right text-base font-bold tabular-nums text-pcl-dark outline-none"
        />
        <span className="text-xs font-medium text-pcl-mid">{suffix}</span>
      </span>
    </label>
  )
}

// --- one window row ------------------------------------------------------
function WindowRow({ row, scaleMax }: { row: WindowCapacity; scaleMax: number }) {
  const state = capacityState(row.utilization)
  const style = STATE_STYLE[state]
  const fillPct = scaleMax > 0 ? Math.min((row.load.baseLoad / scaleMax) * 100, 100) : 0
  const ceilPct = scaleMax > 0 ? Math.min((row.capacity / scaleMax) * 100, 100) : 0

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-28 shrink-0 text-xs font-medium text-pcl-dark">
        {row.phase.name}
        <span className="ml-1 text-pcl-mid">{row.phase.year}</span>
      </span>

      {/* Bar — all windows share one absolute $ scale, so each window's ceiling
          marker lands at its true position and the offseason/during-season
          headroom gap is visually literal. */}
      <div className="relative h-6 flex-1 rounded bg-[#f0f0ef]">
        <div
          className="h-full rounded transition-[width] duration-300"
          style={{ width: `${fillPct}%`, backgroundColor: style.fill }}
        />
        {/* ceiling marker */}
        <div
          className="absolute top-[-3px] bottom-[-3px] w-px bg-pcl-dark/70"
          style={{ left: `${ceilPct}%` }}
        >
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-pcl-mid">
            {fmtMillions(row.capacity)}
          </span>
        </div>
      </div>

      <div className="flex w-40 shrink-0 items-baseline justify-end gap-2">
        <span className={`text-sm font-bold tabular-nums ${style.text}`}>
          {fmtPct(row.utilization, 0)}
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-pcl-mid">
          {style.label}
        </span>
      </div>

      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-pcl-dark">
        {fmtPerDay(row.perWorkday)}
        <span className="text-pcl-mid">/day</span>
      </span>
    </div>
  )
}

function KindGroup({
  title,
  ceiling,
  rows,
  scaleMax,
  note,
}: {
  title: string
  ceiling: number
  rows: WindowCapacity[]
  scaleMax: number
  note: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between border-b border-pcl-light pb-1">
        <h4 className="text-xs font-bold uppercase tracking-wider text-pcl-dark">
          {title}
          <span className="ml-2 font-medium normal-case tracking-normal text-pcl-mid">
            ceiling {fmtMillions(ceiling)} · {note}
          </span>
        </h4>
      </div>
      {rows.map((r) => (
        <WindowRow key={r.phase.id} row={r} scaleMax={scaleMax} />
      ))}
    </div>
  )
}

export default function CapacityTab() {
  const items = useStore((s) => s.items)
  const [cfg, setCfg] = useState<CapacityConfig>({ ...DEFAULT_CAPACITY })
  const [workdays, setWorkdays] = useState(DEFAULT_WORKDAYS)

  const rows = useMemo(
    () => windowCapacityRows(items, cfg, workdays),
    [items, cfg, workdays],
  )

  const offRows = rows.filter((r) => r.phase.kind === 'offseason')
  const dsRows = rows.filter((r) => r.phase.kind === 'during-season')

  // Shared absolute-dollar scale across every window (never below the larger
  // ceiling, extended if a window is loaded past it).
  const scaleMax = Math.max(
    cfg.offseasonBase,
    cfg.duringSeasonBase,
    ...rows.map((r) => r.load.baseLoad),
  )

  const dsShareOfOff =
    cfg.offseasonBase > 0 ? cfg.duringSeasonBase / cfg.offseasonBase : 0

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      {/* Planning-assumption inputs */}
      <section className="rounded-lg border border-pcl-light bg-white p-4">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
            Planning Assumptions
          </h3>
          <span className="rounded-full bg-pcl-green/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-pcl-green">
            editable
          </span>
        </div>
        <div className="flex flex-wrap gap-5">
          <AssumptionInput
            label="Offseason ceiling"
            value={Math.round(cfg.offseasonBase / 1_000_000)}
            suffix="$M / window"
            onChange={(v) => setCfg((c) => ({ ...c, offseasonBase: v * 1_000_000 }))}
          />
          <AssumptionInput
            label="During-season ceiling"
            value={Math.round(cfg.duringSeasonBase / 1_000_000)}
            suffix="$M / window"
            onChange={(v) => setCfg((c) => ({ ...c, duringSeasonBase: v * 1_000_000 }))}
          />
          <AssumptionInput
            label="Workdays / window"
            value={workdays}
            suffix={`days (comp ${WORKDAYS_COMP.min}–${WORKDAYS_COMP.max})`}
            min={1}
            onChange={(v) => setWorkdays(v > 0 ? v : 1)}
          />
        </div>
        <p className="mt-3 text-[11px] font-light text-pcl-mid">
          Throughput ceilings are the physical work an NBA window can absorb in
          2025 base dollars — escalation is excluded so a fixed ceiling isn&apos;t
          inflated. During-season windows cap at {fmtMillions(cfg.duringSeasonBase)},
          just {fmtPct(dsShareOfOff, 0)} of an offseason window&apos;s{' '}
          {fmtMillions(cfg.offseasonBase)} ceiling, so they saturate with far less
          work.
        </p>
      </section>

      {/* Window capacity utilization */}
      <section className="rounded-lg border border-pcl-light bg-white p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
            Window Capacity Utilization
          </h3>
          <span className="text-[11px] font-light text-pcl-mid">
            bars share one $ scale · ┃ = window ceiling
          </span>
        </div>
        <p className="mb-4 text-[11px] font-light text-pcl-mid">
          Included base scope loaded into each window vs its throughput ceiling.
          Implied daily throughput = window base load ÷ {workdays} workdays.
        </p>

        <div className="flex flex-col gap-5 pt-3">
          <KindGroup
            title="Offseason windows"
            ceiling={cfg.offseasonBase}
            rows={offRows}
            scaleMax={scaleMax}
            note="Jun–Sep, ample headroom"
          />
          <KindGroup
            title="During-season windows"
            ceiling={cfg.duringSeasonBase}
            rows={dsRows}
            scaleMax={scaleMax}
            note="Oct–May, tight throughput"
          />
        </div>
      </section>

      <p className="px-1 text-[11px] font-light italic text-pcl-mid">
        Parametric capacity model — a planning proxy that compares loaded base
        dollars to per-window throughput ceilings. This is not a resource-loaded
        schedule: it carries no headcount, crew, craft, or labor-hour data.
      </p>
    </div>
  )
}
