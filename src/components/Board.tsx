import { useStore } from '../store'
import { TIME_PHASES } from '../lib/phases'
import PhaseColumn from './PhaseColumn'

// The draggable board — the six time-window phases, spread across full width.
// (Continuous / Systems Work lives in its own section below.)
export default function Board() {
  const items = useStore((s) => s.items)

  return (
    <div className="px-6 pt-4">
      {/* Discoverability hint — the phase columns are drag-and-drop targets. */}
      <div className="mb-3 flex items-center gap-2 rounded-md border border-l-4 border-[#cfe3d6] border-l-pcl-green bg-[#f0f7f2] px-3 py-2 text-[13px] text-pcl-dark">
        <svg
          viewBox="0 0 8 12"
          aria-hidden
          className="h-3.5 w-2.5 shrink-0 text-pcl-green"
          fill="currentColor"
        >
          <circle cx="2" cy="2" r="1" />
          <circle cx="6" cy="2" r="1" />
          <circle cx="2" cy="6" r="1" />
          <circle cx="6" cy="6" r="1" />
          <circle cx="2" cy="10" r="1" />
          <circle cx="6" cy="10" r="1" />
        </svg>
        <span>
          Drag scope cards between phases to re-sequence the work — cost,
          escalation, and the headline recompute live.
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto">
        {TIME_PHASES.map((phase) => (
          <PhaseColumn
            key={phase.id}
            phase={phase}
            items={items.filter((it) => it.phase === phase.id)}
          />
        ))}
      </div>
    </div>
  )
}
