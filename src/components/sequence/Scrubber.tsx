// Six-window scrubber — chronological chips, OS/DS kind-colored, with Play.
import { KIND_COLORS } from '../../lib/analytics'
import { PHASE_BY_ID } from '../../lib/phases'
import { SEQUENCE_WINDOWS } from '../../data/arenaGeometry'

export interface ScrubberProps {
  selectedIdx: number | null // null = all-windows default state
  playing: boolean
  onSelect: (idx: number | null) => void
  onTogglePlay: () => void
}

export default function Scrubber({ selectedIdx, playing, onSelect, onTogglePlay }: ScrubberProps) {
  const selected = selectedIdx !== null ? SEQUENCE_WINDOWS[selectedIdx] : null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={playing ? 'Pause sequence playback' : 'Play sequence'}
          title={playing ? 'Pause' : 'Play — auto-advance through the six windows'}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white transition-colors hover:bg-accent-hover"
        >
          {playing ? (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden>
              <rect x="1.5" y="1" width="3" height="10" rx="0.8" />
              <rect x="7.5" y="1" width="3" height="10" rx="0.8" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden>
              <path d="M2.5 1.2 L10.8 6 L2.5 10.8 Z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelect(null)}
          title="All windows — mini intensity strips per level"
          className={`rounded-md border px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
            selectedIdx === null
              ? 'border-ink bg-ink text-white'
              : 'border-line bg-white text-ink-muted hover:text-ink'
          }`}
        >
          All
        </button>

        {SEQUENCE_WINDOWS.map((w, i) => {
          const kind = PHASE_BY_ID[w.phase].kind as 'offseason' | 'during-season'
          const color = KIND_COLORS[kind]
          const active = selectedIdx === i
          return (
            <button
              key={w.phase}
              type="button"
              onClick={() => onSelect(i)}
              title={`${w.label} — ${w.caption}`}
              className="rounded-md border px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
              style={
                active
                  ? { backgroundColor: color, borderColor: color, color: '#fff' }
                  : { backgroundColor: `${color}14`, borderColor: `${color}40`, color }
              }
            >
              {w.label}
            </button>
          )
        })}
      </div>
      <p className="min-h-[1rem] text-xs font-light italic text-ink">
        {selected ? selected.caption : 'All windows — select or play to sequence the work'}
      </p>
    </div>
  )
}
