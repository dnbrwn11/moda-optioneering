import { useState } from 'react'
import { useStore } from '../store'
import { escalatedCost } from '../lib/escalation'
import { fmtMillions } from '../lib/format'
import { itemMatches } from '../lib/trades'
import type { LevelId, Trade } from '../types'
import ScopeCard from './ScopeCard'

interface Props {
  showToggles: boolean
  activeLevels: Set<LevelId>
  activeTrades: Set<Trade>
}

// Continuous / Systems Work — not a time window but scope spread across the
// whole construction (MEP/AV/structural/envelope/VT/food svc + aging). Each
// card carries its own 2027/2028/2029 spend allocation. Full-width grid so the
// allocation sliders have room to display without overflow.
export default function ContinuousSection({
  showToggles,
  activeLevels,
  activeTrades,
}: Props) {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  const moveItem = useStore((s) => s.moveItem)
  const [dragOver, setDragOver] = useState(false)

  // Subtotal + count reflect the FULL section — filtering is view-only.
  const contItems = items.filter((it) => it.phase === 'CONT')
  const subtotal = contItems
    .filter((it) => it.included)
    .reduce((sum, it) => sum + escalatedCost(it, rates), 0)

  const filtering = activeLevels.size > 0 || activeTrades.size > 0
  const visibleItems = filtering
    ? contItems.filter((it) => itemMatches(it, activeLevels, activeTrades))
    : contItems

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const id = e.dataTransfer.getData('text/plain')
    if (id) moveItem(id, 'CONT')
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`mx-6 mb-6 mt-4 rounded-lg border bg-white transition-colors ${
        dragOver ? 'border-accent bg-accent/5' : 'border-line'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-ink">
            Continuous / Systems Work
            <span className="ml-2 font-light text-ink-muted">
              — spread across construction
            </span>
          </h2>
          <p className="text-[11px] font-light text-ink-muted">
            {contItems.length} items · base split across 2027–2029 per item (sum
            100%)
          </p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            Section escalated subtotal
          </div>
          <div className="text-xl font-bold tabular-nums text-accent">
            {fmtMillions(subtotal)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibleItems.length === 0 ? (
          <div className="col-span-full flex items-center justify-center rounded-md border-[1.5px] border-dashed border-line px-3 py-6 text-center text-[11px] font-light text-ink-muted">
            No items match filters
          </div>
        ) : (
          visibleItems.map((it) => (
            <ScopeCard key={it.id} item={it} showToggles={showToggles} />
          ))
        )}
      </div>
    </section>
  )
}
