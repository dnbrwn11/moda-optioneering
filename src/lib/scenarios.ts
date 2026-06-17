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

// During-season phases — Capacity Protect empties these of bowl-stadia work.
const DURING_SEASON: PhaseId[] = ['1DS', '2DS', '3DS']

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
      // Move L300/L400 bowl-stadia (club & suite) items out of during-season
      // phases into the matching offseason of the same year.
      return items.map((it) => {
        if (
          (it.level === 'L300' || it.level === 'L400') &&
          DURING_SEASON.includes(it.phase)
        ) {
          const os = it.phase.replace('DS', 'OS') as PhaseId
          return { ...it, phase: os }
        }
        return it
      })

    case 'affordability':
      // Exclude everything currently marked deferrable.
      return items.map((it) =>
        it.status === 'deferrable' ? { ...it, included: false } : it,
      )

    case 'premium-accelerate':
      // Pull L300/L400 premium club items into earlier phases (-> 1OS).
      return items.map((it) => {
        if (
          (it.level === 'L300' || it.level === 'L400') &&
          (it.phase === '3OS' || it.phase === '3DS' || it.phase === '2DS')
        ) {
          return { ...it, phase: '1OS' as PhaseId }
        }
        return it
      })

    default:
      return items
  }
}
