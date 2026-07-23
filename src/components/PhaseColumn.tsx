import { useState } from 'react'
import type { Item, LevelId, Trade } from '../types'
import type { PhaseDef } from '../lib/phases'
import { useStore } from '../store'
import { escalatedCost } from '../lib/escalation'
import { fmtMillions } from '../lib/format'
import {
  CAPACITY_TOOLTIP,
  overloadMessage,
  phaseLoad,
} from '../lib/guardrail'
import { itemMatches } from '../lib/trades'
import ScopeCard from './ScopeCard'

interface Props {
  phase: PhaseDef
  items: Item[]
  compact: boolean
  showToggles: boolean
  activeLevels: Set<LevelId>
  activeTrades: Set<Trade>
}

export default function PhaseColumn({
  phase,
  items,
  compact,
  showToggles,
  activeLevels,
  activeTrades,
}: Props) {
  const rates = useStore((s) => s.rates)
  const moveItem = useStore((s) => s.moveItem)
  const [dragOver, setDragOver] = useState(false)

  // Totals + guardrail always reflect the FULL phase — filtering is a view.
  const includedItems = items.filter((it) => it.included)
  const subtotal = includedItems.reduce(
    (sum, it) => sum + escalatedCost(it, rates),
    0,
  )
  const load = phaseLoad(phase.id, items)

  // Rendered cards respect the active level + trade filters (view only).
  const filtering = activeLevels.size > 0 || activeTrades.size > 0
  const visibleItems = filtering
    ? items.filter((it) => itemMatches(it, activeLevels, activeTrades))
    : items
  const hiddenCount = items.length - visibleItems.length

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const id = e.dataTransfer.getData('text/plain')
    if (id) moveItem(id, phase.id)
  }

  const yearLabel = phase.year === null ? '2027–29' : String(phase.year)

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setDragOver(true)
      }}
      onDragLeave={(e) => {
        // dragleave also fires when moving onto a child card; only clear when
        // the pointer actually exits the column (keeps the tail placeholder
        // from flickering).
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setDragOver(false)
        }
      }}
      onDrop={handleDrop}
      className={`flex min-w-[170px] flex-1 flex-col rounded-lg border bg-column-bg transition-colors ${
        load.overloaded
          ? 'border-alert'
          : dragOver
            ? 'border-accent bg-accent/5'
            : 'border-line'
      }`}
    >
      {/* Header */}
      <div className="rounded-t-lg border-b border-line bg-white px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-ink">{phase.name}</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            {yearLabel}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-[11px] font-light text-ink-muted">
            {items.length} {items.length === 1 ? 'item' : 'items'}
            {filtering && hiddenCount > 0 && (
              <span className="text-ink"> · {visibleItems.length} shown</span>
            )}
          </span>
          <span className="text-base font-bold tabular-nums text-accent">
            {fmtMillions(subtotal)}
          </span>
        </div>

        {/* Guardrail — non-blocking amber/orange overload warning (alerts only) */}
        {load.overloaded && (
          <div
            className="mt-2 flex items-start gap-1.5 rounded border border-alert/40 bg-alert/10 px-2 py-1.5"
            title={CAPACITY_TOOLTIP}
          >
            <span className="text-sm leading-none text-alert" aria-hidden>
              ⚠
            </span>
            <span className="text-[10px] font-medium leading-tight text-alert">
              {overloadMessage(phase.id)}
            </span>
          </div>
        )}
      </div>

      {/* Cards — grow naturally; no inner scroll (page scrolls instead).
          flex-1 makes the list (and the tail zone below the last card) fill
          the stretched column, so the whole column height accepts drops. */}
      <div className="flex flex-1 flex-col gap-2 p-2">
        {items.length === 0 ? (
          <div
            className={`flex items-center justify-center rounded-md border-[1.5px] border-dashed px-3 py-6 text-center text-[11px] font-light transition-colors ${
              dragOver
                ? 'border-accent bg-accent/5 text-accent'
                : 'border-hint-border text-ink-muted'
            }`}
          >
            Drop scope here
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex items-center justify-center rounded-md border-[1.5px] border-dashed border-hint-border px-3 py-6 text-center text-[11px] font-light text-ink-muted">
            No items match filters
          </div>
        ) : (
          visibleItems.map((it) => (
            <ScopeCard
              key={it.id}
              item={it}
              compact={compact}
              showToggles={showToggles}
            />
          ))
        )}

        {/* Tail drop placeholder — outlines where the dragged card will land
            (appended to this phase) while a drag hovers anywhere over the
            column. Hidden when the empty-column hint already shows. */}
        {dragOver && items.length > 0 && (
          <div
            aria-hidden
            className={`rounded-md border-[1.5px] border-dashed border-accent/60 bg-accent/5 ${
              compact ? 'h-8' : 'h-16'
            }`}
          />
        )}
      </div>
    </div>
  )
}
