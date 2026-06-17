import type { Item, PhaseId, ScenarioId } from '../types'
import { buildItems, DEFAULT_RATES } from './seeding'
import rawData from '../data/lineitems.json'
import type { LineItemData } from '../types'

export { DEFAULT_RATES }

const data = rawData as LineItemData

export interface ScenarioDef {
  id: ScenarioId
  label: string
  blurb: string
}

export const SCENARIOS: ScenarioDef[] = [
  {
    id: 'baseline',
    label: 'Baseline (Big Kahuna)',
    blurb: 'The seeded default — the $403M starting point.',
  },
  {
    id: 'capacity-protect',
    label: 'Capacity Protect',
    blurb: 'Push bowl/seating-affecting club & suite work out of during-season windows.',
  },
  {
    id: 'affordability',
    label: 'Affordability',
    blurb: 'Exclude all deferrable scope; recompute.',
  },
  {
    id: 'premium-accelerate',
    label: 'Premium Accelerate',
    blurb: 'Pull L300/L400 premium club work into earlier phases.',
  },
]

// Ancillary, non-guest-facing scope that Affordability designates deferrable
// (support/BOH/circulation + cosmetic overlay refreshes). Required systems are
// never touched. This is the optioneering judgment the tool exists to express.
const ANCILLARY =
  /balance of event|guest services|coat check|stairwells|\bboh\b|boh spaces|support areas|mechanical|sound treatments|garage rework|exterior wall/i

// The seeded baseline, always rebuilt fresh from source data.
function freshBaseline(): Item[] {
  return buildItems(data)
}

// Re-seed item state per the chosen scenario. The escalation engine recomputes
// from the returned state — scenarios only change phase/included/status.
export function applyScenario(scenario: ScenarioId, _current: Item[]): Item[] {
  const items = freshBaseline()

  switch (scenario) {
    case 'baseline':
      return items

    case 'capacity-protect':
      // Pull every during-season task into the matching offseason of the SAME
      // window/year. Empties the game-night windows; because each move stays in
      // the same year, it does so at ~zero escalation premium.
      return items.map((it) => {
        if (it.phase.endsWith('DS')) {
          return { ...it, phase: it.phase.replace('DS', 'OS') as PhaseId }
        }
        return it
      })

    case 'affordability':
      // Mark the ancillary, non-revenue scope deferrable and exclude it —
      // showing the affordable floor. Required building systems are protected.
      return items.map((it) =>
        it.status !== 'required' && ANCILLARY.test(it.name)
          ? { ...it, status: 'deferrable', included: false }
          : it,
      )

    case 'premium-accelerate':
      // Pull L300/L400 premium club & suite work into the first offseason to
      // open the new premium product as early as possible (watch 1OS capacity).
      return items.map((it) => {
        if (
          (it.level === 'L300' || it.level === 'L400') &&
          ['2OS', '2DS', '3OS', '3DS'].includes(it.phase)
        ) {
          return { ...it, phase: '1OS' as PhaseId }
        }
        return it
      })

    default:
      return items
  }
}
