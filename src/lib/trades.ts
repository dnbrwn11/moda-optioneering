import type { Item, LevelId, Trade } from '../types'

// Per-trade accent colors — the scope card's left border + the board TRADE
// filter chips. Muted, distinguishable hues; Interior Buildout is a neutral gray
// (it dominates the discrete board) so specialty trades pop. PCL green stays
// reserved for brand chrome, so it is deliberately absent here.
export const TRADE_ACCENT: Record<Trade, string> = {
  'Interior Buildout': '#8C9199', // neutral gray — blends
  HVAC: '#3E6E9E', // blue
  'Electrical & Low Voltage': '#C0902E', // gold
  Plumbing: '#2E8C86', // teal
  'Fire Protection': '#B0524A', // clay red (distinct from alert orange)
  'Structural/Concrete Repair': '#6B5B95', // violet
  'Bowl & Rigging': '#A85C86', // magenta
  'Building Envelope': '#567C93', // steel
  Sitework: '#7E7040', // khaki
  'Vertical Transportation': '#9E6B4E', // brown
  Seating: '#A85F6E', // rose
  'Acoustical & Specialties': '#8E6BA6', // lavender
  'Audio Visual': '#5566A0', // indigo
  'Food Service Equipment': '#B8843B', // amber
  'Aging Assets (Owner Decision)': '#A0A0A0', // gray — inert ($0)
}

// Short chip labels (full names are long); full name lives in a title attr.
export const TRADE_SHORT: Record<Trade, string> = {
  'Interior Buildout': 'Interior',
  HVAC: 'HVAC',
  'Electrical & Low Voltage': 'Electrical',
  Plumbing: 'Plumbing',
  'Fire Protection': 'Fire',
  'Structural/Concrete Repair': 'Structural',
  'Bowl & Rigging': 'Bowl/Rigging',
  'Building Envelope': 'Envelope',
  Sitework: 'Sitework',
  'Vertical Transportation': 'Vert. Trans.',
  Seating: 'Seating',
  'Acoustical & Specialties': 'Acoustical',
  'Audio Visual': 'AV',
  'Food Service Equipment': 'Food Svc',
  'Aging Assets (Owner Decision)': 'Aging',
}

// Canonical chip order (only trades present in the data get rendered).
export const TRADE_ORDER: Trade[] = [
  'Interior Buildout',
  'HVAC',
  'Electrical & Low Voltage',
  'Plumbing',
  'Fire Protection',
  'Structural/Concrete Repair',
  'Bowl & Rigging',
  'Building Envelope',
  'Sitework',
  'Vertical Transportation',
  'Seating',
  'Acoustical & Specialties',
  'Audio Visual',
  'Food Service Equipment',
  'Aging Assets (Owner Decision)',
]

// Inline style for a trade chip: tinted fill, accent text + border.
export function tradeChipStyle(trade: Trade): React.CSSProperties {
  const hex = TRADE_ACCENT[trade]
  return {
    color: hex,
    backgroundColor: `${hex}14`, // ~8% alpha tint
    borderColor: `${hex}40`, // ~25% alpha border
  }
}

// Combined view filter — an item is visible when it matches BOTH active groups
// (empty group = no constraint). Filtering is view-only; scope data is untouched.
export function itemMatches(
  item: Item,
  activeLevels: Set<LevelId>,
  activeTrades: Set<Trade>,
): boolean {
  const levelOk = activeLevels.size === 0 || activeLevels.has(item.level)
  const tradeOk = activeTrades.size === 0 || activeTrades.has(item.trade)
  return levelOk && tradeOk
}
