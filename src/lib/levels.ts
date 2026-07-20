import type { LevelId } from '../types'
import { levelColors } from './tokens'

// Per-level accent colors — used on the scope card's left border and its level
// tag chip (and the board filter chips) so a level reads consistently wherever
// it appears. Muted, professional, mutually distinguishable hues; values live
// in the design-token authority. Brand accents deliberately absent: reserved
// for chrome.
export const LEVEL_ACCENT: Record<LevelId, string> = levelColors as Record<LevelId, string>

// Order used for the board filter chip row (only levels present in the data are
// actually rendered — the caller intersects with what exists).
export const LEVEL_ORDER: LevelId[] = [
  'L100',
  'L200',
  'L300',
  'L400',
  'L500',
  'L700',
  'OVERLAY',
  'AGING',
]

// Inline style for a level tag chip: tinted fill, accent text + border.
export function levelChipStyle(level: LevelId): React.CSSProperties {
  const hex = LEVEL_ACCENT[level]
  return {
    color: hex,
    backgroundColor: `${hex}14`, // ~8% alpha tint
    borderColor: `${hex}40`, // ~25% alpha border
  }
}
