import { useStore } from '../store'
import { TIME_PHASES } from '../lib/phases'
import type { LevelId, Trade } from '../types'
import PhaseColumn from './PhaseColumn'

interface Props {
  compact: boolean
  showToggles: boolean
  activeLevels: Set<LevelId>
  activeTrades: Set<Trade>
}

// The draggable board — the six time-window phases, spread across full width.
// View state (density, scope toggles, filters) is owned by PhasingTab and
// passed down. (Continuous / Systems Work lives in its own section below.)
export default function Board({
  compact,
  showToggles,
  activeLevels,
  activeTrades,
}: Props) {
  const items = useStore((s) => s.items)

  return (
    <div className="flex items-start gap-3 overflow-x-auto px-6 pt-4">
      {TIME_PHASES.map((phase) => (
        <PhaseColumn
          key={phase.id}
          phase={phase}
          items={items.filter((it) => it.phase === phase.id)}
          compact={compact}
          showToggles={showToggles}
          activeLevels={activeLevels}
          activeTrades={activeTrades}
        />
      ))}
    </div>
  )
}
