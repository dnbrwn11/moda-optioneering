import { useState } from 'react'
import type { Item, ItemStatus, LevelId } from '../types'
import { useStore } from '../store'
import { escalatedCost } from '../lib/escalation'
import { fmtFull } from '../lib/format'

// Level chips: gray scale + green only (no rainbow). OVERLAY/AGING — the
// building-systems levels — read green; numbered levels read neutral gray.
function levelChipClass(level: LevelId): string {
  if (level === 'OVERLAY' || level === 'AGING') {
    return 'bg-pcl-green/10 text-pcl-green border-pcl-green/30'
  }
  return 'bg-black/[0.04] text-pcl-dark border-pcl-light'
}

// Status pills: required (green, building-need), value-add (neutral gray),
// deferrable (indigo — a secondary accent used sparingly). Never orange.
const STATUS_LABEL: Record<ItemStatus, string> = {
  required: 'Required',
  'value-add': 'Value-add',
  deferrable: 'Deferrable',
}
function statusPillClass(status: ItemStatus): string {
  switch (status) {
    case 'required':
      return 'bg-pcl-green/10 text-pcl-green border-pcl-green/30'
    case 'deferrable':
      return 'bg-pcl-indigo/10 text-pcl-indigo border-pcl-indigo/30'
    default:
      return 'bg-black/[0.04] text-pcl-dark border-pcl-light'
  }
}

const STATUS_CYCLE: ItemStatus[] = ['required', 'value-add', 'deferrable']

export default function ScopeCard({ item }: { item: Item }) {
  const rates = useStore((s) => s.rates)
  const toggleIncluded = useStore((s) => s.toggleIncluded)
  const setStatus = useStore((s) => s.setStatus)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const esc = escalatedCost(item, rates)
  const escalatedUp = item.included && esc > item.base + 0.5

  function handleToggle() {
    // "Required" items: excluding needs a confirm — selling point that PCL
    // knows what the building truly needs vs. what's optional.
    if (item.included && item.status === 'required') {
      setConfirmOpen(true)
      return
    }
    toggleIncluded(item.id)
  }

  function cycleStatus() {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(item.status) + 1) % 3]
    setStatus(item.id, next)
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', item.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={`group relative cursor-grab rounded-md border bg-white p-2.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
        item.included ? 'border-pcl-light' : 'border-dashed border-pcl-mid opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${levelChipClass(
            item.level,
          )}`}
        >
          {item.level}
        </span>
        {/* Include toggle */}
        <label className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] font-medium text-pcl-mid">
          <input
            type="checkbox"
            checked={item.included}
            onChange={handleToggle}
            className="h-3.5 w-3.5 cursor-pointer accent-pcl-green"
            aria-label={`Include ${item.name}`}
          />
          {item.included ? 'In' : 'Out'}
        </label>
      </div>

      <p className="mt-1.5 text-xs font-medium leading-snug text-pcl-dark">
        {item.name}
      </p>

      <div className="mt-2 flex items-end justify-between">
        <div className="leading-tight">
          <div className="text-[10px] font-light text-pcl-mid">
            base {fmtFull(item.base)}
          </div>
          <div
            className={`text-sm font-bold tabular-nums ${
              item.included ? 'text-pcl-dark' : 'text-pcl-mid line-through'
            }`}
          >
            {item.included ? fmtFull(esc) : '$0'}
            {escalatedUp && (
              <span className="ml-1 align-middle text-[10px] font-medium text-pcl-green">
                ▲
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={cycleStatus}
          title="Click to change status"
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusPillClass(
            item.status,
          )}`}
        >
          {STATUS_LABEL[item.status]}
        </button>
      </div>

      {/* Required-defer confirm dialog */}
      {confirmOpen && (
        <div className="absolute inset-0 z-10 flex flex-col justify-center gap-2 rounded-md border border-pcl-green bg-white p-3 shadow-lg">
          <p className="text-xs font-medium leading-snug text-pcl-dark">
            This is a building-need system — defer anyway?
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(false)}
              className="rounded border border-pcl-light px-2.5 py-1 text-[11px] font-medium text-pcl-dark hover:bg-black/[0.04]"
            >
              Keep
            </button>
            <button
              type="button"
              onClick={() => {
                toggleIncluded(item.id)
                setConfirmOpen(false)
              }}
              className="rounded bg-pcl-green px-2.5 py-1 text-[11px] font-medium text-white hover:opacity-90"
            >
              Defer anyway
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
