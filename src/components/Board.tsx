import { useStore } from '../store'
import { PHASES } from '../lib/phases'
import PhaseColumn from './PhaseColumn'

export default function Board() {
  const items = useStore((s) => s.items)

  return (
    <main className="flex-1 overflow-x-auto px-6 py-4">
      <div className="flex h-full min-h-0 gap-4">
        {PHASES.map((phase) => (
          <PhaseColumn
            key={phase.id}
            phase={phase}
            items={items.filter((it) => it.phase === phase.id)}
          />
        ))}
      </div>
    </main>
  )
}
