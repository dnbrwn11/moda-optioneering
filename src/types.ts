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

// Native trade/division from the source feasibility estimate. Discrete L100–L700
// scopes are composite fit-out ("Interior Buildout"); CONT/OVERLAY items map 1:1
// to their source divisions. A closed union so a typo is a compile error.
export type Trade =
  | 'Interior Buildout'
  | 'Bowl & Rigging'
  | 'Acoustical & Specialties'
  | 'Structural/Concrete Repair'
  | 'Building Envelope'
  | 'Food Service Equipment'
  | 'Seating'
  | 'Vertical Transportation'
  | 'Plumbing'
  | 'Fire Protection'
  | 'HVAC'
  | 'Electrical & Low Voltage'
  | 'Audio Visual'
  | 'Sitework'
  | 'Aging Assets (Owner Decision)'

export type ItemStatus = 'required' | 'value-add' | 'deferrable'

// Funding Lens classification (see lib/funding.ts for display metadata).
export type FundingClass = 'systems' | 'premium' | 'general'

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
  trade: Trade
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
    reconciliation_note: string
  }
  levels: RawLevel[]
}

// Catalog as fetched from Supabase: the raw shape plus the seed-derived
// per-item defaults stored in the line_items table (phase, status, funding
// class, CONT allocation). Assembled by boot/hydrate.ts into the same
// meta+levels structure the bundled JSON used to provide.
export interface CatalogItem extends RawItem {
  phase: PhaseId
  status: ItemStatus
  fundingClass: FundingClass
  alloc: ContAllocation
}

export interface CatalogLevel {
  id: LevelId
  name: string
  items: CatalogItem[]
}

export interface CatalogData {
  meta: LineItemData['meta']
  levels: CatalogLevel[]
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
  trade: Trade
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
