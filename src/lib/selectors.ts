import { useMemo } from 'react'
import { useStore } from '../store'
import { computeTotals } from './escalation'
import type { Totals } from './escalation'

// Live totals derived from current items + rates.
export function useTotals(): Totals {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  return useMemo(() => computeTotals(items, rates), [items, rates])
}
