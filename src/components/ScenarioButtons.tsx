import { useStore } from '../store'
import { SCENARIOS } from '../lib/scenarios'

// Scenario presets (top-right). Treated as primary nav — PCL yellow marks the
// active preset (dark text), inactive read as quiet outlined chips on the green
// band. Each click re-seeds item state; the engine recomputes transparently.
export default function ScenarioButtons() {
  const active = useStore((s) => s.activeScenario)
  const applyScenario = useStore((s) => s.applyScenario)

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {SCENARIOS.map((s) => {
        const isActive = s.id === active
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => applyScenario(s.id)}
            title={s.blurb}
            aria-pressed={isActive}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-pcl-yellow text-pcl-dark'
                : 'border border-white/40 text-white hover:bg-white/10'
            }`}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
