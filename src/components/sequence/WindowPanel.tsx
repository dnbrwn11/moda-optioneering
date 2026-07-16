// Right panel: selected window's story — cumulative $ (count-up tween),
// % complete, spaces completed, window total, item count, top trades — plus
// wedge-click item detail.
import { useEffect, useRef, useState } from 'react'
import type { EscalationRates, Item, PhaseId } from '../../types'
import type { Totals } from '../../lib/escalation'
import { escalatedCost } from '../../lib/escalation'
import { PHASE_BY_ID } from '../../lib/phases'
import { KIND_COLORS } from '../../lib/analytics'
import { fmtMillions, fmtPct } from '../../lib/format'
import { TRADE_ACCENT, TRADE_SHORT } from '../../lib/trades'
import { levelChipStyle } from '../../lib/levels'
import { GEOMETRY_BY_ID } from '../../data/arenaGeometry'
import type { WindowStats } from '../../lib/sequence'

// Count-up tween — animates toward the target whenever it changes (window
// scrubbing, slider moves), tracking from the currently displayed value.
function useCountUp(target: number, duration = 500): number {
  const [display, setDisplay] = useState(target)
  const displayRef = useRef(target)
  displayRef.current = display

  useEffect(() => {
    const from = displayRef.current
    if (from === target) return
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - (1 - p) ** 3
      setDisplay(from + (target - from) * eased)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return display
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">{label}</span>
      <span className="text-sm font-bold tabular-nums text-pcl-dark">{value}</span>
    </div>
  )
}

export interface WindowPanelProps {
  stats: WindowStats | null // null = all-windows default state
  totals: Totals
  items: Item[]
  rates: EscalationRates
  baselinePhaseById: Record<string, PhaseId>
  detailIds: string[] | null
  onCloseDetail: () => void
}

export default function WindowPanel({
  stats,
  totals,
  items,
  rates,
  baselinePhaseById,
  detailIds,
  onCloseDetail,
}: WindowPanelProps) {
  const cumulative = useCountUp(stats ? stats.cumulative : totals.escalatedTotal)
  const detailItems = detailIds
    ? detailIds.map((id) => items.find((it) => it.id === id)).filter((it): it is Item => !!it)
    : null

  const kind = stats ? (PHASE_BY_ID[stats.window.phase].kind as 'offseason' | 'during-season') : null

  return (
    <aside className="flex flex-col gap-3 rounded-lg border border-pcl-light bg-white p-4">
      {/* Window identity. */}
      <div>
        {stats ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white"
                style={{ backgroundColor: kind ? KIND_COLORS[kind] : '#36383D' }}
              >
                {stats.window.label}
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
                {PHASE_BY_ID[stats.window.phase].name}
              </h3>
            </div>
            <p className="mt-1 text-xs font-light leading-snug text-pcl-dark">
              {stats.window.caption}
            </p>
          </>
        ) : (
          <>
            <h3 className="text-sm font-bold uppercase tracking-wider text-pcl-green">
              Full Program
            </h3>
            <p className="mt-1 text-xs font-light leading-snug text-pcl-dark">
              Six construction windows, 2027–2029. Select or play a window to sequence the work.
            </p>
          </>
        )}
      </div>

      {/* Cumulative — count-up tween. */}
      <div className="rounded-md bg-[#f4f7f5] px-3 py-2.5">
        <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
          {stats ? 'Cumulative Escalated' : 'Program Escalated Total'}
        </span>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold leading-none tabular-nums text-pcl-green">
            {fmtMillions(cumulative)}
          </span>
          <span className="text-xs font-medium tabular-nums text-pcl-dark">
            {fmtPct(stats ? stats.pctComplete : 1, 0)} complete
          </span>
        </div>
        {/* Progress bar. */}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-pcl-light/50">
          <div
            className="h-full rounded-full bg-pcl-green"
            style={{
              width: `${(stats ? stats.pctComplete : 1) * 100}%`,
              transition: 'width 600ms ease',
            }}
          />
        </div>
      </div>

      {stats && (
        <div className="divide-y divide-pcl-light/60">
          <StatRow label="Window Escalated" value={fmtMillions(stats.windowTotal)} />
          <StatRow label="— Systems (CONT) share" value={fmtMillions(stats.contInWindow)} />
          <StatRow label="Scopes This Window" value={stats.itemCount} />
          <StatRow label="Spaces Completed" value={stats.spacesCompleted} />
        </div>
      )}

      {/* Top trades by spend (CONT folded in). */}
      {stats && stats.topTrades.length > 0 && (
        <div>
          <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
            Top Trades This Window
          </span>
          <div className="mt-1.5 flex flex-col gap-1.5">
            {stats.topTrades.map((t) => {
              const max = stats.topTrades[0].amount
              return (
                <div key={t.trade} className="flex items-center gap-2" title={t.trade}>
                  <span className="w-20 shrink-0 truncate text-xs font-medium text-pcl-dark">
                    {TRADE_SHORT[t.trade]}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-sm bg-pcl-light/40">
                    <div
                      className="h-full rounded-sm"
                      style={{
                        width: `${max > 0 ? (t.amount / max) * 100 : 0}%`,
                        backgroundColor: TRADE_ACCENT[t.trade],
                        transition: 'width 600ms ease',
                      }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs font-bold tabular-nums text-pcl-dark">
                    {fmtMillions(t.amount)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Item detail — wedge click. */}
      {detailItems && detailItems.length > 0 && (
        <div className="rounded-md border border-pcl-light bg-[#fafaf9] p-3">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-pcl-mid">
              {detailItems.length > 1 ? 'Distributed Scopes' : 'Scope Detail'}
            </span>
            <button
              type="button"
              onClick={onCloseDetail}
              aria-label="Close scope detail"
              className="text-xs font-bold text-pcl-mid hover:text-pcl-dark"
            >
              ✕
            </button>
          </div>
          <div className="mt-1.5 flex max-h-56 flex-col gap-2 overflow-y-auto">
            {detailItems.map((it) => {
              const def = PHASE_BY_ID[it.phase]
              const moved = baselinePhaseById[it.id] !== undefined && baselinePhaseById[it.id] !== it.phase
              const note = GEOMETRY_BY_ID[it.id]?.note
              return (
                <div key={it.id} className="border-b border-pcl-light/60 pb-2 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold leading-tight text-pcl-dark">{it.name}</span>
                    <span
                      className="shrink-0 rounded border px-1 py-0.5 text-[10px] font-bold"
                      style={levelChipStyle(it.level)}
                    >
                      {it.level}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs text-pcl-dark">
                    <span className="font-medium">{it.trade}</span>
                    <span>·</span>
                    <span>{def.year === null ? 'Continuous' : def.name}</span>
                    {moved && (
                      <span className="font-bold text-[#8a6d00]" title="Phase differs from baseline assignment">
                        ◆ moved
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm font-bold tabular-nums text-pcl-green">
                    {it.included ? fmtMillions(escalatedCost(it, rates)) : 'Excluded — $0'}
                  </div>
                  {note && <p className="mt-0.5 text-[11px] font-light italic text-pcl-mid">{note}</p>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Reconciliation note — the six windows fold CONT straight-line and sum
          exactly to the escalated headline. */}
      <p className="mt-auto pt-1 text-[10px] font-light leading-snug text-pcl-mid">
        Six windows (systems folded in) sum to {fmtMillions(totals.escalatedTotal)} — matches the
        escalated headline. Values recompute live from escalation rates and phase assignments.
      </p>
    </aside>
  )
}
