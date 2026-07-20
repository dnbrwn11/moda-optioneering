// Roadmap tab — the owner's decision calendar, back-cast from each
// construction window through editable procurement/design durations. Same
// declared-assumptions honesty pattern as the Resources/Capacity panels:
// parametric planning math, explicitly not a CPM schedule. Assumptions are
// tab-local state; the long-lead → item mapping reads the live store, so
// phasing edits and scenario switches re-anchor order-by dates automatically.
import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { useTotals } from '../lib/selectors'
import { KIND_COLORS } from '../lib/analytics'
import { fmtMillions } from '../lib/format'
import { tradeChipStyle, TRADE_SHORT } from '../lib/trades'
import {
  computeRoadmap,
  DEFAULT_ROADMAP_ASSUMPTIONS,
  fmtDay,
  LONG_LEAD_CATEGORIES,
} from '../lib/roadmap'
import type { LongLeadKey, RoadmapAssumptions } from '../lib/roadmap'
import type { WindowPhaseId } from '../data/arenaGeometry'
import RoadmapTimeline from './roadmap/RoadmapTimeline'

// --- editable planning-assumption input (Capacity-tab pattern) -------------
function AssumptionInput({
  label,
  value,
  suffix,
  onChange,
  step = 1,
  min = 0,
}: {
  label: React.ReactNode
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
      <span className="flex items-baseline gap-1 self-start rounded border border-pcl-light bg-white px-2 py-1.5 focus-within:border-pcl-green">
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

const cloneDefaults = (): RoadmapAssumptions => ({
  ...DEFAULT_ROADMAP_ASSUMPTIONS,
  longLeadWeeks: { ...DEFAULT_ROADMAP_ASSUMPTIONS.longLeadWeeks },
})

export default function RoadmapTab() {
  const items = useStore((s) => s.items)
  const totals = useTotals()
  const [assumptions, setAssumptions] = useState<RoadmapAssumptions>(cloneDefaults)

  const setGlobal = (key: 'designWeeks' | 'buyoutWeeks' | 'generalLeadWeeks', v: number) =>
    setAssumptions((a) => ({ ...a, [key]: v }))
  const setLead = (key: LongLeadKey, v: number) =>
    setAssumptions((a) => ({ ...a, longLeadWeeks: { ...a.longLeadWeeks, [key]: v } }))

  // Durations aren't cost-driven — today is the only external time input.
  const today = useMemo(() => {
    const now = new Date()
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  }, [])

  const roadmap = useMemo(
    () => computeRoadmap(items, assumptions, today),
    [items, assumptions, today],
  )

  const moneyByPhase = useMemo(() => {
    const out = {} as Record<WindowPhaseId, number>
    for (const r of roadmap.rows) out[r.phase] = totals.phaseWithContinuous[r.phase]
    return out
  }, [roadmap.rows, totals])

  const atRiskCount = roadmap.decisions.filter((d) => d.atRisk).length

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      {/* Assumptions panel. */}
      <section className="rounded-lg border border-pcl-light bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
              Procurement &amp; Design Assumptions
            </h3>
            <span className="rounded-full bg-pcl-green/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-pcl-green">
              editable
            </span>
          </div>
          <button
            type="button"
            onClick={() => setAssumptions(cloneDefaults())}
            className="shrink-0 rounded border border-pcl-green px-3 py-1 text-xs font-medium text-pcl-green transition-colors hover:bg-pcl-green hover:text-white"
          >
            Reset to defaults
          </button>
        </div>

        <div className="flex flex-wrap gap-5">
          <AssumptionInput
            label="Design development + documents"
            value={assumptions.designWeeks}
            suffix="wks"
            onChange={(v) => setGlobal('designWeeks', v)}
          />
          <AssumptionInput
            label="Buyout / award"
            value={assumptions.buyoutWeeks}
            suffix="wks"
            onChange={(v) => setGlobal('buyoutWeeks', v)}
          />
          <AssumptionInput
            label="Submittal / fabrication (general)"
            value={assumptions.generalLeadWeeks}
            suffix="wks"
            onChange={(v) => setGlobal('generalLeadWeeks', v)}
          />
        </div>

        <div className="mt-4 border-t border-pcl-light/60 pt-3">
          <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
            Long-lead overrides
          </span>
          <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {LONG_LEAD_CATEGORIES.map((c) => (
              <AssumptionInput
                key={c.key}
                label={
                  <span className="flex items-center gap-1.5 normal-case tracking-normal">
                    <span
                      className="rounded border px-1 py-px text-[10px] font-bold"
                      style={tradeChipStyle(c.trade)}
                    >
                      {TRADE_SHORT[c.trade]}
                    </span>
                    <span className="text-[11px] font-medium text-pcl-dark">{c.label}</span>
                  </span>
                }
                value={assumptions.longLeadWeeks[c.key]}
                suffix="wks"
                onChange={(v) => setLead(c.key, v)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Timeline. */}
      <section className="rounded-lg border border-pcl-light bg-white p-4">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
            Owner Decision Timeline
          </h3>
          {atRiskCount > 0 && (
            <span className="text-xs font-bold uppercase tracking-wide text-pcl-orange">
              {atRiskCount} at risk
            </span>
          )}
        </div>
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-pcl-dark">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-[#d5d7d4]" aria-hidden /> Design
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm bg-[#b0b5b1]" aria-hidden /> Buyout
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-sm border border-dashed border-[#9aa09b] bg-white" aria-hidden /> Fabrication
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: KIND_COLORS.offseason, opacity: 0.4 }} aria-hidden /> Offseason window
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: KIND_COLORS['during-season'], opacity: 0.4 }} aria-hidden /> During-season window
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rotate-45 bg-pcl-indigo" aria-hidden /> Long-lead order-by
          </span>
          <span className="flex items-center gap-1.5 text-pcl-orange">
            <span className="h-2 w-2 rounded-full bg-pcl-orange" aria-hidden /> At risk (past today)
          </span>
        </div>
        <RoadmapTimeline
          rows={roadmap.rows}
          marks={roadmap.marks}
          today={today}
          moneyByPhase={moneyByPhase}
        />
      </section>

      {/* Decision table — soonest first. */}
      <section className="rounded-lg border border-pcl-light bg-white p-4">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-pcl-green">
          Decision Calendar
        </h3>
        <div className="divide-y divide-pcl-light/60">
          {roadmap.decisions.map((d) => {
            const kind = d.kind === 'decision' ? 'Decide' : 'Order'
            return (
              <div
                key={`${d.kind}-${d.windowPhase}-${d.what}`}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-1.5"
              >
                <span
                  className={`w-24 shrink-0 text-xs font-bold tabular-nums ${
                    d.atRisk ? 'text-pcl-orange' : 'text-pcl-dark'
                  }`}
                >
                  {fmtDay(d.date)}
                </span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                  style={{
                    backgroundColor:
                      KIND_COLORS[
                        d.windowPhase.endsWith('OS') ? 'offseason' : 'during-season'
                      ],
                  }}
                >
                  {d.windowLabel}
                </span>
                <span className="shrink-0 rounded bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-pcl-mid">
                  {kind}
                </span>
                <span className="min-w-0 flex-1 text-xs font-medium text-pcl-dark">
                  {d.what}
                </span>
                <span className="shrink-0 text-[11px] font-light text-pcl-mid">
                  {d.leadNote}
                </span>
                <span className="w-16 shrink-0 text-right text-[11px] tabular-nums text-pcl-mid">
                  {fmtMillions(moneyByPhase[d.windowPhase] ?? 0)}
                </span>
                {d.atRisk && (
                  <span className="shrink-0 rounded bg-pcl-orange px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    at risk
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <p className="px-1 text-[11px] font-light italic text-pcl-mid">
        Parametric procurement model — planning assumptions, not a CPM schedule. Durations are
        editable estimates for owner discussion. Long-lead order-by dates anchor to each
        category&rsquo;s first-need window from the live phase assignments; excluded equipment
        scopes drop their markers.
      </p>
    </div>
  )
}
