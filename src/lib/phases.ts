import type { ContAllocation, ContYear, PhaseId, Year } from '../types'

// Ordered phases (the OS/DS map from Image 1), each mapped to a calendar year.
// CONT spreads evenly across 2027/2028/2029 (year = null sentinel).
export interface PhaseDef {
  id: PhaseId
  name: string
  short: string
  year: Year | null
  kind: 'offseason' | 'during-season' | 'continuous'
}

export const PHASES: PhaseDef[] = [
  { id: '1OS', name: '1st Offseason', short: '1 OS', year: 2027, kind: 'offseason' },
  { id: '1DS', name: '1st During-Season', short: '1 DS', year: 2027, kind: 'during-season' },
  { id: '2OS', name: '2nd Offseason', short: '2 OS', year: 2028, kind: 'offseason' },
  { id: '2DS', name: '2nd During-Season', short: '2 DS', year: 2028, kind: 'during-season' },
  { id: '3OS', name: '3rd Offseason', short: '3 OS', year: 2029, kind: 'offseason' },
  { id: '3DS', name: '3rd During-Season', short: '3 DS', year: 2029, kind: 'during-season' },
  { id: 'CONT', name: 'Continuous', short: 'CONT', year: null, kind: 'continuous' },
]

// The six time-window phases (the draggable board). CONT is handled separately
// in its own full-width section.
export const TIME_PHASES: PhaseDef[] = PHASES.filter((p) => p.id !== 'CONT')

export const PHASE_BY_ID: Record<PhaseId, PhaseDef> = PHASES.reduce(
  (acc, p) => {
    acc[p.id] = p
    return acc
  },
  {} as Record<PhaseId, PhaseDef>,
)

// Years CONT spend is spread across.
export const CONT_YEARS: ContYear[] = [2027, 2028, 2029]

export const ESCALATION_YEARS: Year[] = [2026, 2027, 2028, 2029]

// Default per-item CONT allocation — an even-ish split that keeps the seeded
// baseline tied to ~$403.8M. Sums to 100.
export const DEFAULT_CONT_ALLOC: ContAllocation = { 2027: 33, 2028: 33, 2029: 34 }
