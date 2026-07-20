import { useEffect, useState } from 'react'
import type { Item, ItemStatus } from '../types'
import { useStore } from '../store'
import { useRefPhaseById } from '../lib/selectors'
import { escalatedCost } from '../lib/escalation'
import { allocSum } from '../lib/alloc'
import { CONT_YEARS, PHASE_BY_ID } from '../lib/phases'
import { fmtFull } from '../lib/format'
import { TRADE_ACCENT } from '../lib/trades'

// Level tag — now neutral gray (card color identity belongs to the trade accent).
const LEVEL_CHIP = 'shrink-0 rounded border border-pcl-light bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-pcl-dark'

// Small "excluded" mark shown (in place of a checkbox) when scope toggles are off.
function ExcludedMark() {
  return (
    <span className="shrink-0 rounded bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-pcl-mid">
      excluded
    </span>
  )
}

// A 6-dot drag grip — muted at rest, PCL green on card hover.
function Grip() {
  return (
    <svg
      viewBox="0 0 8 12"
      aria-hidden
      className="h-3 w-2 shrink-0 text-[#9aa6a0] transition-colors group-hover:text-pcl-green"
      fill="currentColor"
    >
      <circle cx="2" cy="2" r="1" />
      <circle cx="6" cy="2" r="1" />
      <circle cx="2" cy="6" r="1" />
      <circle cx="6" cy="6" r="1" />
      <circle cx="2" cy="10" r="1" />
      <circle cx="6" cy="10" r="1" />
    </svg>
  )
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

// Per-year spend allocation editor (CONT items only). Three mini-sliders whose
// percents always sum to 100 (enforced by rebalanceAlloc in the store). The
// running total is shown and flags red if it ever drifts off 100.
function AllocEditor({
  item,
  onInteractStart,
}: {
  item: Item
  onInteractStart: () => void
}) {
  const setAlloc = useStore((s) => s.setAlloc)
  const sum = allocSum(item.alloc)
  const balanced = sum === 100

  return (
    <div className="mt-2 rounded border border-pcl-light bg-black/[0.02] p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-pcl-mid">
          Spend allocation
        </span>
        <span
          className={`text-[10px] font-bold tabular-nums ${
            balanced ? 'text-pcl-green' : 'text-pcl-orange'
          }`}
        >
          Σ {sum}%
        </span>
      </div>
      {CONT_YEARS.map((y) => (
        <div key={y} className="flex items-center gap-2 py-0.5">
          <span className="w-9 shrink-0 text-[10px] font-medium tabular-nums text-pcl-dark">
            {y}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={item.alloc[y]}
            onPointerDown={onInteractStart}
            onChange={(e) => setAlloc(item.id, y, Number(e.target.value))}
            aria-label={`${item.name} ${y} allocation`}
            className="h-1 flex-1 cursor-pointer"
          />
          <span className="w-9 shrink-0 text-right text-[10px] font-bold tabular-nums text-pcl-dark">
            {item.alloc[y]}%
          </span>
        </div>
      ))}
    </div>
  )
}

export default function ScopeCard({
  item,
  compact = false,
  showToggles = true,
}: {
  item: Item
  compact?: boolean
  showToggles?: boolean
}) {
  const rates = useStore((s) => s.rates)
  const toggleIncluded = useStore((s) => s.toggleIncluded)
  const setStatus = useStore((s) => s.setStatus)
  const compareOn = useStore((s) => s.compareScenarioId !== null)
  const refPhaseById = useRefPhaseById()
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Disable card drag while a slider is being manipulated, so dragging the
  // thumb doesn't start a card drag. Re-enabled on any pointer release.
  const [dragEnabled, setDragEnabled] = useState(true)

  useEffect(() => {
    const reenable = () => setDragEnabled(true)
    window.addEventListener('pointerup', reenable)
    window.addEventListener('dragend', reenable)
    return () => {
      window.removeEventListener('pointerup', reenable)
      window.removeEventListener('dragend', reenable)
    }
  }, [])

  const isCont = item.phase === 'CONT'

  const esc = escalatedCost(item, rates)
  const escalatedUp = item.included && esc > item.base + 0.5

  // Compare mode: badge items whose phase differs from the comparison
  // scenario's assignment — moved-marker palette (matches the sequence ◆).
  const refPhase = refPhaseById[item.id]
  const wasBadge = compareOn && refPhase !== undefined && refPhase !== item.phase && (
    <span
      className="shrink-0 rounded bg-pcl-yellow/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#8a6d00]"
      title={`${PHASE_BY_ID[refPhase].name} in comparison scenario`}
    >
      was {PHASE_BY_ID[refPhase].short}
    </span>
  )

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

  const accentStyle = {
    borderLeftColor: TRADE_ACCENT[item.trade],
    borderLeftWidth: 3,
  } as const

  const dragProps = {
    draggable: dragEnabled,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData('text/plain', item.id)
      e.dataTransfer.effectAllowed = 'move'
    },
  }

  // Confirm dialog for deferring a required (building-need) item — shared by
  // both densities.
  const confirmDialog = confirmOpen && (
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
  )

  // --- Compact density — single line: grip · level tag · name · $ · include ---
  if (compact) {
    return (
      <div
        {...dragProps}
        style={accentStyle}
        className={`group relative flex cursor-grab items-center gap-2 rounded-md border bg-white px-2 py-1.5 shadow-sm transition-all hover:shadow-md active:cursor-grabbing ${
          item.included ? 'border-pcl-light' : 'border-dashed border-pcl-mid opacity-60'
        }`}
      >
        <Grip />
        <span className={LEVEL_CHIP}>{item.level}</span>
        <span
          className="min-w-0 flex-1 truncate text-xs font-medium text-pcl-dark"
          title={item.name}
        >
          {item.name}
        </span>
        {wasBadge}
        {!showToggles && !item.included && <ExcludedMark />}
        <span
          className={`shrink-0 text-xs font-bold tabular-nums ${
            item.included ? 'text-pcl-dark' : 'text-pcl-mid line-through'
          }`}
        >
          {item.included ? fmtFull(esc) : '$0'}
        </span>
        {showToggles && (
          <input
            type="checkbox"
            checked={item.included}
            onChange={handleToggle}
            className="h-3.5 w-3.5 shrink-0 cursor-pointer accent-pcl-green"
            aria-label={`Include ${item.name}`}
          />
        )}
        {confirmDialog}
      </div>
    )
  }

  return (
    <div
      {...dragProps}
      style={accentStyle}
      className={`group relative cursor-grab rounded-md border bg-white p-2.5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md active:cursor-grabbing ${
        item.included ? 'border-pcl-light' : 'border-dashed border-pcl-mid opacity-60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5">
          {/* Drag affordance — 6-dot grip. Whole card is the drag activator
              (native HTML5 DnD); this is a visual cue only. */}
          <Grip />
          <span className={LEVEL_CHIP}>{item.level}</span>
          {wasBadge}
        </span>
        {/* Include toggle — or an "excluded" mark when scope toggles are off. */}
        {showToggles ? (
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
        ) : (
          !item.included && <ExcludedMark />
        )}
      </div>

      <p
        className="mt-1.5 text-xs font-medium leading-snug text-pcl-dark"
        title={item.name}
      >
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

      {/* CONT items: per-year spend allocation (2027/2028/2029, sum = 100%) */}
      {isCont && (
        <AllocEditor item={item} onInteractStart={() => setDragEnabled(false)} />
      )}

      {/* Required-defer confirm dialog */}
      {confirmDialog}
    </div>
  )
}
