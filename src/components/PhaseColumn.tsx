import { useState } from 'react'
import type { Item } from '../types'
import type { PhaseDef } from '../lib/phases'
import { useStore } from '../store'
import { escalatedCost } from '../lib/escalation'
import { fmtMillions } from '../lib/format'
import ScopeCard from './ScopeCard'

interface Props {
  phase: PhaseDef
  items: Item[]
}

export default function PhaseColumn({ phase, items }: Props) {
  const rates = useStore((s) => s.rates)
  const moveItem = useStore((s) => s.moveItem)
  const [dragOver, setDragOver] = useState(false)

  const includedItems = items.filter((it) => it.included)
  const subtotal = includedItems.reduce(
    (sum, it) => sum + escalatedCost(it, rates),
    0,
  )

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
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex w-64 shrink-0 flex-col rounded-lg border bg-[#f7f7f6] transition-colors ${
        dragOver ? 'border-pcl-green bg-pcl-green/5' : 'border-pcl-light'
      }`}
    >
      {/* Header */}
      <div className="rounded-t-lg border-b border-pcl-light bg-white px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-bold text-pcl-dark">{phase.name}</span>
          <span className="text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
            {yearLabel}
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span className="text-[11px] font-light text-pcl-mid">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
          <span className="text-base font-bold tabular-nums text-pcl-green">
            {fmtMillions(subtotal)}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {items.length === 0 ? (
          <p className="px-1 py-4 text-center text-[11px] font-light text-pcl-mid">
            Drop scope here
          </p>
        ) : (
          items.map((it) => <ScopeCard key={it.id} item={it} />)
        )}
      </div>
    </div>
  )
}
