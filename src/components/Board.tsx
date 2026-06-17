import { useStore } from '../store'
import { TIME_PHASES } from '../lib/phases'
import PhaseColumn from './PhaseColumn'

// The draggable board — the six time-window phases, spread across full width.
// (Continuous / Systems Work lives in its own section below.)
export default function Board() {
  const items = useStore((s) => s.items)

  return (
    <div className="flex gap-3 overflow-x-auto px-6 pt-4">
      {TIME_PHASES.map((phase) => (
        <PhaseColumn
          key={phase.id}
          phase={phase}
          items={items.filter((it) => it.phase === phase.id)}
        />
      ))}
    </div>
  )
}
