// Single floating hover tooltip for the Sequence views — one React-rendered
// instance, portaled to the app root and positioned from mouse coordinates.
// Styled to be visually indistinguishable from the Analytics Recharts
// tooltips (white card, #CFCFCF border, 8px radius, 12px type).
//
// Content components read the live store themselves, so a tooltip left open
// while rates change never shows stale dollars.
import { useLayoutEffect, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../store'
import { useTotals } from '../../lib/selectors'
import { escalatedCost } from '../../lib/escalation'
import { PHASE_BY_ID } from '../../lib/phases'
import { KIND_COLORS } from '../../lib/analytics'
import { fmtMillions } from '../../lib/format'
import { TRADE_SHORT, tradeChipStyle } from '../../lib/trades'
import { levelChipStyle } from '../../lib/levels'
import { GEOMETRY_BY_ID, SEQUENCE_WINDOWS } from '../../data/arenaGeometry'
import { itemWindowSpend, SYSTEMS_GOLD } from '../../lib/sequence'
import type { Trade } from '../../types'

export interface TipState {
  content: React.ReactNode
  x: number
  y: number
}

// Views call this on shape enter (with the mouse event) and leave (null).
export type HoverHandler = (content: React.ReactNode | null, e?: React.MouseEvent) => void

const OFFSET = 12

function place(el: HTMLDivElement, cx: number, cy: number) {
  const w = el.offsetWidth
  const h = el.offsetHeight
  // Flip placement near viewport edges so the card never clips.
  let x = cx + OFFSET
  let y = cy + OFFSET
  if (x + w > window.innerWidth - 8) x = cx - OFFSET - w
  if (y + h > window.innerHeight - 8) y = cy - OFFSET - h
  el.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`
}

export function FloatingTooltip({ tip }: { tip: TipState | null }) {
  const ref = useRef<HTMLDivElement>(null)

  // Position before first paint (no top-left flash), then follow the cursor
  // with direct DOM writes — no React re-render per mousemove.
  useLayoutEffect(() => {
    if (tip && ref.current) place(ref.current, tip.x, tip.y)
  }, [tip])

  useEffect(() => {
    if (!tip) return
    const move = (e: MouseEvent) => {
      if (ref.current) place(ref.current, e.clientX, e.clientY)
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [tip])

  if (!tip) return null
  return createPortal(
    <div
      ref={ref}
      className="pointer-events-none fixed left-0 top-0 z-50 max-w-[280px] rounded-lg border bg-white px-3 py-2 text-xs text-pcl-dark shadow-md"
      style={{ borderColor: '#CFCFCF', animation: 'seq-tip-in 100ms ease-out' }}
      role="tooltip"
    >
      {tip.content}
    </div>,
    document.body,
  )
}

// ── Shared content bits ────────────────────────────────────────────────────

function windowLine(phase: string) {
  const def = PHASE_BY_ID[phase as keyof typeof PHASE_BY_ID]
  const color =
    def.year === null
      ? SYSTEMS_GOLD
      : KIND_COLORS[def.kind as 'offseason' | 'during-season']
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} aria-hidden />
      <span className="font-medium" style={{ color }}>
        {def.year === null ? 'Continuous / Systems' : def.name}
      </span>
    </span>
  )
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-pcl-mid">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  )
}

// ── Wedge / segment / band content ─────────────────────────────────────────

export function ItemTip({ id }: { id: string }) {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  const item = items.find((it) => it.id === id)
  if (!item) return null
  const geo = GEOMETRY_BY_ID[id]
  const multi = geo && (geo.treatment !== 'located' || geo.shape.kind === 'segments')

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-bold leading-tight">{item.name}</span>
      <span className="flex flex-wrap items-center gap-1">
        <span className="rounded border px-1 py-px text-[10px] font-bold" style={levelChipStyle(item.level)}>
          {item.level}
        </span>
        <span className="rounded border px-1 py-px text-[10px] font-bold" style={tradeChipStyle(item.trade)}>
          {TRADE_SHORT[item.trade]}
        </span>
      </span>
      {windowLine(item.phase)}
      <div className="flex flex-col gap-0.5 border-t pt-1.5" style={{ borderColor: '#ececeb' }}>
        <MoneyRow label="Base (2025)" value={fmtMillions(item.base)} />
        <MoneyRow
          label="Escalated"
          value={item.included ? fmtMillions(escalatedCost(item, rates)) : 'Excluded — $0'}
        />
        {item.qty > 1 && <MoneyRow label="Area" value={`${item.qty.toLocaleString('en-US')} SF`} />}
      </div>
      {multi && <span className="italic text-pcl-mid">(multiple locations)</span>}
    </div>
  )
}

// Distributed tint band — several scopes with no single position.
export function DistributedTip({ ids }: { ids: string[] }) {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  const scoped = ids
    .map((id) => items.find((it) => it.id === id))
    .filter((it): it is NonNullable<typeof it> => !!it)
  if (scoped.length === 0) return null
  if (scoped.length === 1) return <ItemTip id={scoped[0].id} />
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-bold leading-tight">Distributed scopes</span>
      <span className="italic text-pcl-mid">(multiple locations)</span>
      <div className="flex flex-col gap-1 border-t pt-1.5" style={{ borderColor: '#ececeb' }}>
        {scoped.map((it) => (
          <div key={it.id} className="flex items-baseline justify-between gap-4">
            <span className="flex items-center gap-1.5 truncate">
              {it.name}
              <span className="shrink-0">{windowLine(it.phase)}</span>
            </span>
            <span className="shrink-0 font-bold tabular-nums">
              {it.included ? fmtMillions(escalatedCost(it, rates)) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Halo / spine content ───────────────────────────────────────────────────

export function SystemsTip({ selectedIdx }: { selectedIdx: number | null }) {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  const totals = useTotals()
  const selected = selectedIdx !== null ? SEQUENCE_WINDOWS[selectedIdx] : null

  let amount: number
  const byTrade = new Map<Trade, number>()
  if (selected) {
    amount = totals.phaseWithContinuous[selected.phase] - totals.phaseSubtotals[selected.phase]
    for (const it of items) {
      if (it.phase !== 'CONT' || !it.included) continue
      const s = itemWindowSpend(it, rates, selected.phase)
      if (s > 0) byTrade.set(it.trade, (byTrade.get(it.trade) ?? 0) + s)
    }
  } else {
    amount = totals.continuousTotal
    for (const it of items) {
      if (it.phase !== 'CONT' || !it.included) continue
      byTrade.set(it.trade, (byTrade.get(it.trade) ?? 0) + escalatedCost(it, rates))
    }
  }
  const top2 = [...byTrade.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2)

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-bold leading-tight" style={{ color: SYSTEMS_GOLD }}>
        Building Systems (continuous)
      </span>
      <span className="text-pcl-mid">
        {selected ? `${selected.label} — ${PHASE_BY_ID[selected.phase].name}` : 'Full program'}
      </span>
      <div className="flex flex-col gap-0.5 border-t pt-1.5" style={{ borderColor: '#ececeb' }}>
        <MoneyRow label={selected ? 'Systems this window' : 'Systems total'} value={fmtMillions(amount)} />
        {top2.map(([trade, amt]) => (
          <div key={trade} className="flex items-baseline justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span
                className="rounded border px-1 py-px text-[10px] font-bold"
                style={tradeChipStyle(trade)}
              >
                {TRADE_SHORT[trade]}
              </span>
            </span>
            <span className="font-bold tabular-nums">{fmtMillions(amt)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
