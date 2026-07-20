import type { PlanLevelId } from '../../data/arenaGeometry'

// Callout for one of the selected window's largest wedges — rendered as an
// external leader-line label in the view gutters (see Callouts.tsx).
export interface CalloutSpec {
  id: string
  level: PlanLevelId
  name: string
  money: string
}
