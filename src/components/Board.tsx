import { useEffect } from 'react'
import { useStore } from '../store'
import { TIME_PHASES } from '../lib/phases'
import type { LevelId, Trade } from '../types'
import PhaseColumn from './PhaseColumn'

// Native HTML5 DnD has no built-in page auto-scroll, so long boards become
// unreachable mid-drag. While a drag is over the window, scroll the page when
// the pointer nears the top/bottom viewport edge (speed ramps toward the edge).
function useDragAutoScroll() {
  useEffect(() => {
    const EDGE = 80
    const MAX_SPEED = 18
    let pointerY: number | null = null
    let raf = 0

    function step() {
      if (pointerY !== null) {
        const h = window.innerHeight
        if (pointerY < EDGE) {
          window.scrollBy(0, -MAX_SPEED * (1 - pointerY / EDGE))
        } else if (pointerY > h - EDGE) {
          window.scrollBy(0, MAX_SPEED * (1 - (h - pointerY) / EDGE))
        }
      }
      raf = requestAnimationFrame(step)
    }
    function onDragOver(e: DragEvent) {
      pointerY = e.clientY
      if (!raf) raf = requestAnimationFrame(step)
    }
    function stop() {
      pointerY = null
      if (raf) {
        cancelAnimationFrame(raf)
        raf = 0
      }
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', stop)
    window.addEventListener('dragend', stop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', stop)
      window.removeEventListener('dragend', stop)
      stop()
    }
  }, [])
}

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
  useDragAutoScroll()

  return (
    // items-stretch: every column runs the full height of the tallest one, so
    // each column's droppable surface covers the whole row — not just its cards.
    <div className="flex items-stretch gap-3 overflow-x-auto px-6 pt-4">
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
