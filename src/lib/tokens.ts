// Typed access to the design-token authority (src/theme/tokens.json) for
// runtime consumers (chart props, SVG fills, palette maps). Tailwind reads
// the same JSON in tailwind.config.js; index.css mirrors it as :root vars.
import tokens from '../theme/tokens.json'

export const color = tokens.color
export const ramp = tokens.ramp as string[]
export const seq = tokens.sequence
export const win = tokens.window
export const kindContinuous = tokens.kindContinuous
export const tradeColors = tokens.trade as Record<string, string>
export const levelColors = tokens.level as Record<string, string>
export const fundingColors = tokens.funding
export const printColors = tokens.print

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

const accentRgb = hexToRgb(color.accent)

// Shared Recharts theme — the one home for axis/grid/tooltip chrome.
export const chart = {
  axisTick: { fontSize: 11, fill: color.inkMuted },
  grid: color.gridline,
  axisLine: { stroke: color.line },
  tooltipStyle: {
    borderRadius: 8,
    border: `1px solid ${color.line}`,
    fontSize: 12,
  },
  cursorFill: `rgba(${accentRgb[0]}, ${accentRgb[1]}, ${accentRgb[2]}, 0.06)`,
} as const
