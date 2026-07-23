import type { LevelId } from '../types'
import { levelColors } from './tokens'

// Per-level accent colors — the one level palette app-wide (Phasing board
// cards/chips, Sequence tab rings/legend, print report). Values live in the
// design-token authority and are tuned to work at two strengths: full (solid
// chips with white text, left borders — every hue ≥ 4.5:1 vs white) and tint
// (~10% alpha card backgrounds — ink text ≥ 10:1 on every tint). Brand
// accents deliberately absent: reserved for chrome.
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

// Tint strength — the level color at ~10% alpha over white (card backgrounds).
export function levelTint(level: LevelId): string {
  return `${LEVEL_ACCENT[level]}1A`
}

// Full strength — solid-filled chip (level tag on cards, active filter chips).
export function levelSolidChipStyle(level: LevelId): React.CSSProperties {
  const hex = LEVEL_ACCENT[level]
  return { backgroundColor: hex, borderColor: hex, color: '#fff' }
}
