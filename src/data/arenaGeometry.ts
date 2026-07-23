// Schematic plan geometry for the Sequence tab.
//
// DATA ONLY — placement semantics for the 51 discrete L100–L700 scopes plus
// the six-window sequence captions. Widths, ring radii and window shading are
// derived live in src/lib/sequence.ts from the runtime items (SF + base cost),
// so this file never duplicates a number that already lives in lineitems.json.
//
// ─────────────────────────────────────────────────────────────────────────
// COORDINATE SYSTEM & BUILDING ORIENTATION (authoritative)
//   • Angles in degrees, 0° = North at the top of the screen, clockwise
//     positive (90° = East, 180° = South, 270° = West).
//   • Court long-axis runs North–South (verified: benches on the west
//     sideline, concert stage / service end at the north baseline).
//   • North (315°–45°)  = service end — Garden Garage attaches to the
//     building's north side; loading, marshalling, kitchen live here.
//   • West  (225°–315°) = team / bench side.
//   • South (135°–225°) = main public entry side (SW corner entry,
//     fountain plaza).
//   • East  (45°–135°)  = Wheeler Ave entry side.
//
// The plan is a stylized original schematic — nested ellipses ~1.25:1
// (wider E–W than tall N–S) — NOT traced from any seating map.
// ─────────────────────────────────────────────────────────────────────────

import type { PhaseId } from '../types'
import { getAppConstants } from '../boot/catalog'

// Levels that appear as plan rings (OVERLAY/AGING are the continuous systems
// halo/spine, not a ring).
export type PlanLevelId = 'L100' | 'L200' | 'L300' | 'L400' | 'L500' | 'L700'

export const PLAN_LEVELS: PlanLevelId[] = ['L100', 'L200', 'L300', 'L400', 'L500', 'L700']

// Ellipse aspect: plan x-radius / y-radius (wider E–W than tall N–S).
export const PLAN_ASPECT = 1.25

export const SCHEMATIC_FOOTNOTE =
  'Schematic plan — conceptual sequencing view, not to scale.'

// Fixed bearings, 0°=N clockwise. Encoded exactly per the verified orientation.
export const ARENA_ORIENTATION = {
  angleConvention: '0deg = north (top of screen), clockwise (E=90, S=180, W=270)',
  courtLongAxis: 'north-south' as const,
  quadrants: {
    north: { from: 315, to: 45, meaning: 'service end — Garden Garage, loading, marshalling, kitchen' },
    east: { from: 45, to: 135, meaning: 'Wheeler Ave entry side' },
    south: { from: 135, to: 225, meaning: 'main public entry side — SW corner entry, fountain plaza' },
    west: { from: 225, to: 315, meaning: 'team / bench side' },
  },
} as const

// ── Item placement specs ───────────────────────────────────────────────────
// `confidence: 'assumed'` marks angles awaiting later correction — kept in the
// data, rendered normally (no visual flags). Omitted = verified/derived.
export type Confidence = 'assumed'

// Visual treatment: 'located' = solid wedge · 'semi' = lighter semi-located
// treatment (multi-location groups) · 'distributed' = tint on remaining arc.
export type Treatment = 'located' | 'semi' | 'distributed'

export type ItemShapeSpec =
  // A single wedge centered on `angle`. Width is proportional to item SF
  // within its ring (min 8° for clickability) unless `span` fixes it.
  | { kind: 'wedge'; angle: number; span?: number }
  // Thin annular band hugging the full court perimeter (Courtside Club).
  | { kind: 'annular' }
  // Multiple separated segments at the given center angles. Total width is
  // proportional to item SF split across segments, unless `segmentSpan`
  // fixes each segment's width.
  | { kind: 'segments'; centers: number[]; segmentSpan?: number }
  // No single position — rendered as a tint filling the ring's remaining arc.
  | { kind: 'distributed' }

export interface ItemGeometry {
  id: string // must match a lineitems.json discrete item id
  level: PlanLevelId
  treatment: Treatment
  shape: ItemShapeSpec
  confidence?: Confidence
  note?: string
}

export const ITEM_GEOMETRY: ItemGeometry[] = [
  // ── L100 · Event Floor ────────────────────────────────────────────────────
  { id: 'L100-01', level: 'L100', treatment: 'located', shape: { kind: 'annular' }, note: 'Courtside Club — thin band hugging the full court perimeter (wraps the bowl)' },
  { id: 'L100-02', level: 'L100', treatment: 'located', shape: { kind: 'wedge', angle: 260 }, note: 'Home Team Areas — bench side, lockers behind' },
  { id: 'L100-03', level: 'L100', treatment: 'located', shape: { kind: 'wedge', angle: 90 }, note: 'Sideline Club East Side' },
  { id: 'L100-04', level: 'L100', treatment: 'located', shape: { kind: 'segments', centers: [135, 225, 90], segmentSpan: 8 }, note: 'New Club Entries (3) — small wedges at the three public entry corners' },
  { id: 'L100-05', level: 'L100', treatment: 'located', shape: { kind: 'wedge', angle: 280 }, note: 'Sideline Club #2 West Side' },
  { id: 'L100-06', level: 'L100', treatment: 'located', shape: { kind: 'wedge', angle: 350 }, note: 'Kitchen/Commissary — north service end' },
  { id: 'L100-07', level: 'L100', treatment: 'located', shape: { kind: 'wedge', angle: 330 }, note: 'Aux Lockers & Show Offices' },
  { id: 'L100-08', level: 'L100', treatment: 'located', shape: { kind: 'wedge', angle: 20 }, note: 'Staff Lockers/Laundry' },
  { id: 'L100-09', level: 'L100', treatment: 'located', shape: { kind: 'wedge', angle: 240 }, note: 'WNBA Locker Area' },
  { id: 'L100-10', level: 'L100', treatment: 'located', shape: { kind: 'wedge', angle: 10 }, note: 'Add Loading Dock Ramp — north service end' },
  { id: 'L100-11', level: 'L100', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Balance of Event Floor — tint on remaining L100 arc' },

  // ── L200 · Main Concourse ─────────────────────────────────────────────────
  { id: 'L200-01', level: 'L200', treatment: 'located', shape: { kind: 'wedge', angle: 90 }, note: 'East Sideline Club' },
  { id: 'L200-02', level: 'L200', treatment: 'located', shape: { kind: 'wedge', angle: 270 }, note: 'West Sideline Club' },
  { id: 'L200-03', level: 'L200', treatment: 'located', shape: { kind: 'wedge', angle: 195 }, confidence: 'assumed', note: 'Circular Entry Renovations — main south-entry curved glass form' },
  { id: 'L200-04', level: 'L200', treatment: 'located', shape: { kind: 'wedge', angle: 315 }, note: 'North Entry Renovations — verified NW corner' },
  { id: 'L200-05', level: 'L200', treatment: 'semi', shape: { kind: 'segments', centers: [22, 112, 202, 292] }, confidence: 'assumed', note: 'Restrooms Group #1 — interleaved with Group #2 so half the banks stay open in any window' },
  { id: 'L200-06', level: 'L200', treatment: 'semi', shape: { kind: 'segments', centers: [67, 157, 247, 337] }, confidence: 'assumed', note: 'Restrooms Group #2 — interleaved with Group #1 (wider: larger SF)' },
  { id: 'L200-07', level: 'L200', treatment: 'semi', shape: { kind: 'wedge', angle: 45 }, note: 'Concessions — multi-location group, semi-located' },
  { id: 'L200-08', level: 'L200', treatment: 'located', shape: { kind: 'wedge', angle: 180 }, note: 'Guest Services/Coat Check' },
  { id: 'L200-09', level: 'L200', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Stairwells' },
  { id: 'L200-10', level: 'L200', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'BOH Spaces' },
  { id: 'L200-11', level: 'L200', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Mechanical' },
  { id: 'L200-12', level: 'L200', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Balance of Main Concourse' },

  // ── L300 · Club Level ─────────────────────────────────────────────────────
  { id: 'L300-01', level: 'L300', treatment: 'located', shape: { kind: 'wedge', angle: 0 }, note: 'North Club/Neighborhood — wide arc' },
  { id: 'L300-02', level: 'L300', treatment: 'located', shape: { kind: 'wedge', angle: 90, span: 60 }, note: 'Club Level Suites — arc region 60°–120° (east flank)' },
  { id: 'L300-03', level: 'L300', treatment: 'located', shape: { kind: 'segments', centers: [90, 270] }, note: 'Sideline/Center Court Clubs — paired wedges at east & west center court' },
  { id: 'L300-04', level: 'L300', treatment: 'located', shape: { kind: 'wedge', angle: 205 }, confidence: 'assumed', note: 'Rotunda Club — adjacent to main-entry rotunda form, offset from Circular Entry' },
  { id: 'L300-05', level: 'L300', treatment: 'located', shape: { kind: 'wedge', angle: 180, span: 72 }, note: 'South Club/Neighborhood — widest arc, wraps the south baseline behind the premium entries/rotunda wedges' },
  { id: 'L300-06', level: 'L300', treatment: 'located', shape: { kind: 'wedge', angle: 160 }, note: 'Premium Entries/Lobbies' },
  { id: 'L300-07', level: 'L300', treatment: 'located', shape: { kind: 'wedge', angle: 215 }, note: 'Premium Elevator Lobby' },
  { id: 'L300-08', level: 'L300', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Toilet Renovations' },
  { id: 'L300-09', level: 'L300', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Stairwells' },
  { id: 'L300-10', level: 'L300', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'BOH Spaces' },
  { id: 'L300-11', level: 'L300', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Mechanical' },

  // ── L400 · Suite Level ────────────────────────────────────────────────────
  { id: 'L400-01', level: 'L400', treatment: 'located', shape: { kind: 'wedge', angle: 315 }, note: 'Northwest Neighborhood Club' },
  { id: 'L400-02', level: 'L400', treatment: 'located', shape: { kind: 'wedge', angle: 225 }, note: 'Southwest Neighborhood Club' },
  { id: 'L400-03', level: 'L400', treatment: 'located', shape: { kind: 'wedge', angle: 135 }, note: 'Southeast Neighborhood Club' },
  { id: 'L400-04', level: 'L400', treatment: 'located', shape: { kind: 'wedge', angle: 45 }, note: 'Northeast Neighborhood Club' },
  { id: 'L400-05', level: 'L400', treatment: 'semi', shape: { kind: 'segments', centers: [90, 270], segmentSpan: 60 }, note: 'Remodel Existing Suites — the 78 suites line the east and west flanks (60°–120° and 240°–300°)' },
  { id: 'L400-06', level: 'L400', treatment: 'located', shape: { kind: 'wedge', angle: 180 }, note: 'Premium Lobby Areas' },
  { id: 'L400-07', level: 'L400', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Support Areas' },
  { id: 'L400-08', level: 'L400', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Stairwells' },
  { id: 'L400-09', level: 'L400', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'BOH' },

  // ── L500 · Upper Concourse ────────────────────────────────────────────────
  { id: 'L500-01', level: 'L500', treatment: 'semi', shape: { kind: 'wedge', angle: 45 }, note: 'Concessions — semi-located' },
  { id: 'L500-02', level: 'L500', treatment: 'semi', shape: { kind: 'segments', centers: [110, 230, 350] }, note: 'Restrooms — separated multi-location banks, total width proportional to SF' },
  { id: 'L500-03', level: 'L500', treatment: 'located', shape: { kind: 'wedge', angle: 180 }, note: 'Elevator Lobby' },
  { id: 'L500-04', level: 'L500', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Stairwells' },
  { id: 'L500-05', level: 'L500', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'BOH Spaces' },
  { id: 'L500-06', level: 'L500', treatment: 'distributed', shape: { kind: 'distributed' }, note: 'Upper Concourse finishes' },

  // ── L700 · Press Level ────────────────────────────────────────────────────
  { id: 'L700-01', level: 'L700', treatment: 'located', shape: { kind: 'wedge', angle: 270 }, confidence: 'assumed', note: 'Press Level Finishes — press/camera side on the west bench sideline' },
  { id: 'L700-02', level: 'L700', treatment: 'located', shape: { kind: 'wedge', angle: 300 }, confidence: 'assumed', note: 'Alaska Airlines Boxes' },
]

export const GEOMETRY_BY_ID: Record<string, ItemGeometry> = ITEM_GEOMETRY.reduce(
  (acc, g) => {
    acc[g.id] = g
    return acc
  },
  {} as Record<string, ItemGeometry>,
)

// ── Six-window build sequence ──────────────────────────────────────────────
// Captions lifted verbatim from the source cost-sequence phases. `phase` links
// each window to the existing PhaseId (src/lib/phases.ts); CONT is excluded —
// it renders as the Building Systems halo (2D) / spine (3D).
export type WindowPhaseId = Extract<PhaseId, '1OS' | '1DS' | '2OS' | '2DS' | '3OS' | '3DS'>

export interface SequenceWindow {
  index: number // 1-based chronological position
  phase: WindowPhaseId
  label: string
  caption: string
}

// Caption strings are scope descriptions from the source estimate — served
// from app_constants ('sequence_captions'), never bundled. This module lives
// in the lazy app chunk, so the catalog is initialized by the time it evals.
const CAPTIONS = getAppConstants().sequence_captions

export const SEQUENCE_WINDOWS: SequenceWindow[] = (
  [
    { index: 1, phase: '1OS', label: '1st OS' },
    { index: 2, phase: '1DS', label: '1st DS' },
    { index: 3, phase: '2OS', label: '2nd OS' },
    { index: 4, phase: '2DS', label: '2nd DS' },
    { index: 5, phase: '3OS', label: '3rd OS' },
    { index: 6, phase: '3DS', label: '3rd DS' },
  ] as const
).map((w) => ({ ...w, caption: CAPTIONS[w.phase] ?? '' }))
