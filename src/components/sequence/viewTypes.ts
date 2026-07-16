import type { PlanLevelId } from '../../data/arenaGeometry'

// Static $ label for one of the selected window's largest wedges.
export interface StaticLabel {
  id: string
  level: PlanLevelId
  text: string
}

// Nudge later labels downward when two anchors would overprint (adjacent
// rings/plates often center wedges on the same bearing).
export function spreadLabelAnchors(
  anchors: (readonly [number, number])[],
): (readonly [number, number])[] {
  const out: [number, number][] = []
  for (const [x, y] of anchors) {
    let ny = y
    let collided = true
    while (collided) {
      collided = out.some(([px, py]) => Math.abs(px - x) < 150 && Math.abs(py - ny) < 14)
      if (collided) ny += 15
    }
    out.push([x, ny])
  }
  return out
}
