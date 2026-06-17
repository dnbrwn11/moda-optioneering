// Domain types for the Moda Center phase-optioneering dashboard.

export type LevelId =
  | 'L100'
  | 'L200'
  | 'L300'
  | 'L400'
  | 'L500'
  | 'L700'
  | 'OVERLAY'
  | 'AGING'

export type PhaseId = '1OS' | '1DS' | '2OS' | '2DS' | '3OS' | '3DS' | 'CONT'

export type ItemStatus = 'required' | 'value-add' | 'deferrable'

export type Year = 2026 | 2027 | 2028 | 2029

// CONT items spread their base across these spend years via a per-item
// allocation (integer percents that always sum to 100).
export type ContYear = 2027 | 2028 | 2029
export type ContAllocation = Record<ContYear, number>

// Shape as authored in src/data/lineitems.json.
export interface RawItem {
  id: string
  name: string
  qty: number
  unit: number | null
  base: number
  derived?: boolean
}

export interface RawLevel {
  id: LevelId
  name: string
  items: RawItem[]
}

export interface LineItemData {
  meta: {
    source: string
    basis: string
    reported_base_total: number
    reported_escalated_total: number
    note: string
  }
  levels: RawLevel[]
}

// Runtime line item = raw data + optioneering state.
export interface Item {
  id: string
  name: string
  level: LevelId
  levelName: string
  qty: number
  unit: number | null
  base: number
  derived: boolean
  // runtime state
  phase: PhaseId
  included: boolean
  status: ItemStatus
  // Per-year spend allocation — only meaningful while phase === 'CONT'.
  // Integer percents (2027/2028/2029) that always sum to 100.
  alloc: ContAllocation
}

// Per-year escalation rates (fractional, e.g. 0.05 = 5%).
export type EscalationRates = Record<Year, number>
