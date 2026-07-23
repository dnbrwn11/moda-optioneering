// Participation tab — diverse-business (COBID-certified) and workforce
// participation planning per the Moda term sheet Community Benefits
// commitments (Exhibit B: participation goals; Exhibit C: delivery
// conditions). Every percentage is a declared, editable planning assumption.
// Strictly a view/planning dimension: subcontract $ comes from
// tradeWindowSpend (which reuses computeTotals) and craft hours from the
// resources.ts craftHours primitive — no cost, escalation, or labor math is
// reimplemented here, so footing to the escalated headline holds by
// construction.
import type { PhaseId, Trade } from '../types'
import { TIME_PHASES } from './phases'
import type { PhaseDef } from './phases'
import { craftHours } from './resources'
import { TRADE_ORDER } from './trades'

export interface ParticipationAssumptions {
  // Achievable COBID-certified participation share per trade package (0–1).
  tradePct: Record<Trade, number>
  programGoal: number // program-wide certified goal (0–1)
  apprenticePct: number // share of craft hours worked by apprentices (0–1)
  localHirePct: number // share of craft hours worked by local hires (0–1)
}

export const APPRENTICE_YEAR_HOURS = 2000

// Placeholder defaults until real package-level assessments are provided.
export const PARTICIPATION_DEFAULTS: ParticipationAssumptions = {
  tradePct: {
    'Interior Buildout': 0.25,
    Sitework: 0.3,
    'Acoustical & Specialties': 0.25,
    'Building Envelope': 0.2,
    'Structural/Concrete Repair': 0.2,
    Plumbing: 0.18,
    'Fire Protection': 0.18,
    HVAC: 0.15,
    'Electrical & Low Voltage': 0.15,
    'Bowl & Rigging': 0.15,
    Seating: 0.12,
    'Food Service Equipment': 0.12,
    'Audio Visual': 0.1,
    'Vertical Transportation': 0.08,
    'Aging Assets (Owner Decision)': 0, // item is $0 → inert
  },
  programGoal: 0.2,
  apprenticePct: 0.15,
  localHirePct: 0.6,
}

export const PARTICIPATION_CAPTION =
  'Participation planning model — goal percentages pending Definitive Agreements; certified participation measured via Oregon COBID certification.'

export const PROGRAM_GOAL_LABEL = '[XX]% pending Definitive Agreements'

// Exhibit C delivery-framework facts — fixed conditions, not options.
export const DELIVERY_CONDITIONS = [
  'Project Labor Agreement',
  'Prevailing Wage',
  'Labor Peace Agreement',
] as const

export const DELIVERY_NOTE =
  'Delivery conditions per term sheet Exhibit C — reflected in labor planning assumptions.'

// ── Trade participation ────────────────────────────────────────────────────

export interface TradeParticipationRow {
  trade: Trade
  subcontract: number // escalated $ for the package (sum of the 6 windows)
  pct: number // achievable certified share (0–1)
  certified: number // subcontract × pct
}

export function participationRows(
  spendByTrade: Map<Trade, Record<PhaseId, number>>,
  tradePct: Record<Trade, number>,
): TradeParticipationRow[] {
  return TRADE_ORDER.map((trade) => {
    const windows = spendByTrade.get(trade)
    const subcontract = windows
      ? TIME_PHASES.reduce((s, p) => s + windows[p.id], 0)
      : 0
    const pct = tradePct[trade] ?? 0
    return { trade, subcontract, pct, certified: subcontract * pct }
  })
}

export interface ParticipationRollup {
  totalSubcontract: number
  totalCertified: number
  programPct: number // certified share of total subcontract (0–1)
  goal: number
  gapDollars: number // certified $ above (+) / below (−) the goal
  gapPoints: number // programPct − goal, fractional
  onTrack: boolean
}

export function participationRollup(
  rows: TradeParticipationRow[],
  programGoal: number,
): ParticipationRollup {
  const totalSubcontract = rows.reduce((s, r) => s + r.subcontract, 0)
  const totalCertified = rows.reduce((s, r) => s + r.certified, 0)
  const programPct = totalSubcontract > 0 ? totalCertified / totalSubcontract : 0
  const gapDollars = totalCertified - programGoal * totalSubcontract
  return {
    totalSubcontract,
    totalCertified,
    programPct,
    goal: programGoal,
    gapDollars,
    gapPoints: programPct - programGoal,
    onTrack: gapDollars >= 0,
  }
}

// ── Workforce projection ───────────────────────────────────────────────────

export interface WorkforceWindow {
  phase: PhaseDef
  craftHours: number
  apprenticeHours: number
  localHours: number
}

export interface WorkforceSummary {
  windows: WorkforceWindow[]
  totalHours: number
  apprenticeHours: number
  localHours: number
  apprenticeYears: number
}

// Per-window craft hours summed across trades via the shared resources.ts
// primitive — the same figure the Resources crew matrix implies (before its
// hours→crew rounding). Apprentice/local shares apply uniformly to hours;
// peak factor and crew-week hours convert hours to headcount only, so they
// deliberately do not appear here.
export function workforceSummary(
  spendByTrade: Map<Trade, Record<PhaseId, number>>,
  fractions: Record<Trade, number>,
  blendedRate: number,
  apprenticePct: number,
  localHirePct: number,
): WorkforceSummary {
  const windows: WorkforceWindow[] = TIME_PHASES.map((phase) => {
    let hours = 0
    for (const [trade, spend] of spendByTrade) {
      hours += craftHours(spend[phase.id], fractions[trade] ?? 0, blendedRate)
    }
    return {
      phase,
      craftHours: hours,
      apprenticeHours: hours * apprenticePct,
      localHours: hours * localHirePct,
    }
  })
  const totalHours = windows.reduce((s, w) => s + w.craftHours, 0)
  const apprenticeHours = totalHours * apprenticePct
  return {
    windows,
    totalHours,
    apprenticeHours,
    localHours: totalHours * localHirePct,
    apprenticeYears: apprenticeHours / APPRENTICE_YEAR_HOURS,
  }
}
