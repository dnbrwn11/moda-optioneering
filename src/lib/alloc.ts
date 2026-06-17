import type { ContAllocation, ContYear } from '../types'
import { CONT_YEARS } from './phases'

const clampPct = (v: number) => Math.max(0, Math.min(100, Math.round(v)))

export function allocSum(alloc: ContAllocation): number {
  return CONT_YEARS.reduce((s, y) => s + alloc[y], 0)
}

// Set one year's percent and rebalance the other two so the three always sum
// to exactly 100. The other two absorb the change proportionally to their
// current weights (split evenly if both are zero). Result is integer percents.
export function rebalanceAlloc(
  alloc: ContAllocation,
  changedYear: ContYear,
  rawValue: number,
): ContAllocation {
  const value = clampPct(rawValue)
  const others = CONT_YEARS.filter((y) => y !== changedYear) as ContYear[]
  const remaining = 100 - value
  const otherSum = others.reduce((s, y) => s + alloc[y], 0)

  const [a, b] = others
  let na: number
  if (otherSum === 0) {
    na = Math.floor(remaining / 2)
  } else {
    na = Math.round((remaining * alloc[a]) / otherSum)
  }
  const nb = remaining - na // guarantees the sum is exactly 100

  const next = { ...alloc, [changedYear]: value } as ContAllocation
  next[a] = na
  next[b] = nb
  return next
}
