// Currency formatting helpers.
// Headline: $XXX.XM. Cards: full $ with commas.

export function fmtMillions(value: number): string {
  return `$${(value / 1_000_000).toFixed(1)}M`
}

export function fmtFull(value: number): string {
  return `$${Math.round(value).toLocaleString('en-US')}`
}

export function fmtPct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`
}

// Signed delta in millions, e.g. "+$2.4M" / "-$1.1M".
export function fmtDeltaMillions(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}$${(Math.abs(value) / 1_000_000).toFixed(1)}M`
}

export function fmtDeltaPct(fraction: number): string {
  const sign = fraction > 0 ? '+' : fraction < 0 ? '-' : ''
  return `${sign}${(Math.abs(fraction) * 100).toFixed(1)}%`
}
