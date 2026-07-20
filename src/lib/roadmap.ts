// Roadmap-tab derivations: the owner's decision calendar, back-cast from each
// construction window's fixed calendar start through editable procurement and
// design durations. Parametric planning math only — declared assumptions, no
// CPM logic. All dates are UTC (Date.UTC) so day arithmetic never drifts
// across timezones; the calendar authority is SEASON_WINDOWS + PHASE_BY_ID.
import type { Item, Trade } from '../types'
import { SEASON_WINDOWS } from './escalation'
import { CONT_YEARS, PHASE_BY_ID, TIME_PHASES } from './phases'
import type { WindowPhaseId } from '../data/arenaGeometry'

// ── Assumptions ────────────────────────────────────────────────────────────

export type LongLeadKey =
  | 'switchgear'
  | 'ahu'
  | 'elevator'
  | 'seating'
  | 'foodsvc'
  | 'av'

export interface LongLeadCategory {
  key: LongLeadKey
  label: string
  trade: Trade
  defaultWeeks: number
}

// Flagged long-lead categories, mapped to the corresponding trade-tagged
// items (each is a single OVERLAY equipment line in the current catalog).
export const LONG_LEAD_CATEGORIES: LongLeadCategory[] = [
  { key: 'switchgear', label: 'Electrical switchgear/distribution', trade: 'Electrical & Low Voltage', defaultWeeks: 44 },
  { key: 'ahu', label: 'AHUs / major HVAC equipment', trade: 'HVAC', defaultWeeks: 36 },
  { key: 'elevator', label: 'Elevators / escalators', trade: 'Vertical Transportation', defaultWeeks: 40 },
  { key: 'seating', label: 'Fixed seating', trade: 'Seating', defaultWeeks: 28 },
  { key: 'foodsvc', label: 'Food service equipment', trade: 'Food Service Equipment', defaultWeeks: 24 },
  { key: 'av', label: 'AV / broadcast systems', trade: 'Audio Visual', defaultWeeks: 20 },
]

export interface RoadmapAssumptions {
  designWeeks: number // design development + documents before buyout
  buyoutWeeks: number // buyout/award
  generalLeadWeeks: number // submittal/fabrication general lead
  longLeadWeeks: Record<LongLeadKey, number>
}

export const DEFAULT_ROADMAP_ASSUMPTIONS: RoadmapAssumptions = {
  designWeeks: 16,
  buyoutWeeks: 8,
  generalLeadWeeks: 10,
  longLeadWeeks: LONG_LEAD_CATEGORIES.reduce(
    (acc, c) => {
      acc[c.key] = c.defaultWeeks
      return acc
    },
    {} as Record<LongLeadKey, number>,
  ),
}

// ── Calendar math ──────────────────────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function addWeeks(d: Date, weeks: number): Date {
  return new Date(d.getTime() + weeks * WEEK_MS)
}

// Fixed calendar span of a construction window: offseason Jun 1 – Sep 30 of
// its year; during-season Oct 1 – May 31 wrapping into the following year.
// Month numbers come from SEASON_WINDOWS — the same source escalation uses.
export function windowCalendar(phase: WindowPhaseId): { start: Date; end: Date } {
  const def = PHASE_BY_ID[phase]
  const year = def.year as number
  const season = def.kind === 'offseason' ? SEASON_WINDOWS.offseason : SEASON_WINDOWS.duringSeason
  const startIdx = season.startMonth - 1
  const endIdx = season.endMonth - 1
  const endYear = season.endMonth < season.startMonth ? year + 1 : year
  return {
    start: new Date(Date.UTC(year, startIdx, 1)),
    // Day 0 of the following month = last day of endMonth.
    end: new Date(Date.UTC(endYear, endIdx + 1, 0)),
  }
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmtDay(d: Date): string {
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}

export function fmtMonthYr(d: Date): string {
  return `${MONTHS_SHORT[d.getUTCMonth()]} ’${String(d.getUTCFullYear()).slice(2)}`
}

// ── Back-cast derivation ───────────────────────────────────────────────────

export interface WindowRow {
  phase: WindowPhaseId
  short: string
  name: string
  kind: 'offseason' | 'during-season'
  start: Date
  end: Date
  fabStart: Date // start − general lead
  buyoutStart: Date // fabStart − buyout
  decision: Date // buyoutStart − design = owner decision / design release
  atRisk: boolean
}

export interface LongLeadMark {
  key: LongLeadKey
  label: string
  trade: Trade
  window: WindowPhaseId
  weeks: number
  orderBy: Date // window start − override lead
  atRisk: boolean
}

export interface DecisionEntry {
  date: Date
  windowPhase: WindowPhaseId
  windowLabel: string
  what: string
  leadNote: string
  kind: 'decision' | 'order'
  trade?: Trade
  atRisk: boolean
}

// First window an item serves: its own window if assigned to a discrete
// phase; for CONT items the OS window of the earliest alloc year with >0%
// (equipment is ordered once for first need). Excluded items serve none.
export function firstNeedWindow(item: Item): WindowPhaseId | null {
  if (!item.included) return null
  if (item.phase !== 'CONT') {
    return PHASE_BY_ID[item.phase]?.year != null ? (item.phase as WindowPhaseId) : null
  }
  for (const y of CONT_YEARS) {
    if ((item.alloc?.[y] ?? 0) > 0) {
      const os = TIME_PHASES.find((p) => p.year === y && p.kind === 'offseason')
      if (os) return os.id as WindowPhaseId
    }
  }
  return null
}

export interface Roadmap {
  rows: WindowRow[]
  marks: LongLeadMark[]
  decisions: DecisionEntry[]
}

export function computeRoadmap(
  items: Item[],
  a: RoadmapAssumptions,
  today: Date,
): Roadmap {
  const rows: WindowRow[] = TIME_PHASES.map((p) => {
    const { start, end } = windowCalendar(p.id as WindowPhaseId)
    const fabStart = addWeeks(start, -a.generalLeadWeeks)
    const buyoutStart = addWeeks(fabStart, -a.buyoutWeeks)
    const decision = addWeeks(buyoutStart, -a.designWeeks)
    return {
      phase: p.id as WindowPhaseId,
      short: p.short,
      name: p.name,
      kind: p.kind as 'offseason' | 'during-season',
      start,
      end,
      fabStart,
      buyoutStart,
      decision,
      atRisk: decision.getTime() < today.getTime(),
    }
  })
  const rowByPhase = new Map(rows.map((r) => [r.phase, r]))

  const marks: LongLeadMark[] = []
  for (const cat of LONG_LEAD_CATEGORIES) {
    // Earliest first-need window across this category's included items.
    let win: WindowRow | null = null
    for (const it of items) {
      if (it.trade !== cat.trade) continue
      const w = firstNeedWindow(it)
      if (!w) continue
      const row = rowByPhase.get(w)
      if (row && (!win || row.start.getTime() < win.start.getTime())) win = row
    }
    if (!win) continue // excluded / fully unallocated → no order to place
    const weeks = a.longLeadWeeks[cat.key]
    const orderBy = addWeeks(win.start, -weeks)
    marks.push({
      key: cat.key,
      label: cat.label,
      trade: cat.trade,
      window: win.phase,
      weeks,
      orderBy,
      atRisk: orderBy.getTime() < today.getTime(),
    })
  }

  const decisions: DecisionEntry[] = [
    ...rows.map<DecisionEntry>((r) => ({
      date: r.decision,
      windowPhase: r.phase,
      windowLabel: r.short,
      what: `Design release — ${r.name} scope`,
      leadNote: `${a.designWeeks} wk design + ${a.buyoutWeeks} wk buyout + ${a.generalLeadWeeks} wk lead`,
      kind: 'decision',
      atRisk: r.atRisk,
    })),
    ...marks.map<DecisionEntry>((m) => ({
      date: m.orderBy,
      windowPhase: m.window,
      windowLabel: rowByPhase.get(m.window)?.short ?? m.window,
      what: `Place order — ${m.label}`,
      leadNote: `${m.weeks} wk fabrication lead`,
      kind: 'order',
      trade: m.trade,
      atRisk: m.atRisk,
    })),
  ].sort((x, y) => x.date.getTime() - y.date.getTime())

  return { rows, marks, decisions }
}

// Timeline axis span: Jan 2026 through the end of the last window (May 2030),
// so every construction window renders in full.
export const AXIS_START = new Date(Date.UTC(2026, 0, 1))
export const AXIS_END = new Date(Date.UTC(2030, 4, 31))
