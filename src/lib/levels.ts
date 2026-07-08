import type { LevelId } from '../types'

// Per-level accent colors — used on the scope card's left border and its level
// tag chip (and the board filter chips) so a level reads consistently wherever
// it appears. Muted, professional, mutually distinguishable hues. PCL green is
// deliberately absent: it stays reserved for brand chrome.
export const LEVEL_ACCENT: Record<LevelId, string> = {
  L100: '#4F6D8F', // steel blue
  L200: '#6B5B95', // muted violet
  L300: '#3F7E86', // deep teal
  L400: '#94607A', // mauve
  L500: '#B8873B', // ochre
  L700: '#5C6B7A', // slate
  OVERLAY: '#A2554E', // clay red — systems overlay
  AGING: '#8A6D3B', // bronze — aging infrastructure
}

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
