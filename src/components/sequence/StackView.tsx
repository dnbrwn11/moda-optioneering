// 3D exploded axonometric stack — same data as the 2D plan, projected with
// pure SVG math (no 3D libraries). Plan point (x, y) at plate height z maps to
// screen (x·1.0, y·0.45 − z): an axis-aligned isometric squash, so plan arcs
// sampled in lib/sequence become true elliptical arcs on the plates.
//
// The whole stack scales to fit the visible panel (max-height cap below) —
// fitting all six plates plus the spine matters more than plate size.
import { LEVEL_ACCENT } from '../../lib/levels'
import { COURT_R, ellipsePath, planXY, stripCellFill, SYSTEMS_GOLD } from '../../lib/sequence'
import type { ItemShade, LevelPlacements, ProjectFn, RingSpec } from '../../lib/sequence'
import { PLAN_LEVELS, SEQUENCE_WINDOWS } from '../../data/arenaGeometry'
import type { PlanLevelId } from '../../data/arenaGeometry'
import LevelShapes, { placementAnchor } from './RingShapes'
import CalloutLayer from './Callouts'
import { SystemsTip } from './SequenceTooltip'
import type { HoverHandler } from './SequenceTooltip'
import type { CalloutSpec } from './viewTypes'

const W = 960
const H = 900
const CX = 512
const S = 176 // plan px per normalized radius (x) — plate half-width
const SQUASH = 0.45 // spec: screen y = plan y · 0.45 − z
const PLATE_RY = (S / 1.25) * SQUASH // ≈ 63 — plate ellipse y-radius
const WALL = 11 // extruded side-wall thickness
// Vertical explode: the gap must clear a full plate's projected height plus
// its side wall so no plate occludes another's wedges (the governing intent
// of the ~0.6× explode guidance — 0.6× would clip every ring's north half).
const Z_STEP = Math.round(2 * PLATE_RY + WALL + 6) // ≈ 144
const BASE_Y = H - PLATE_RY - WALL - 12 // L100 plate center; plates step upward

const LEVEL_NAMES: Record<PlanLevelId, string> = {
  L100: 'L100 Event',
  L200: 'L200 Concourse',
  L300: 'L300 Club',
  L400: 'L400 Suite',
  L500: 'L500 Upper',
  L700: 'L700 Press',
}

function plateCy(levelIdx: number): number {
  return BASE_Y - levelIdx * Z_STEP
}

function plateProject(levelIdx: number): ProjectFn {
  const cy = plateCy(levelIdx)
  return (x, y) => [CX + x * S, cy + y * S * SQUASH]
}

// Extruded front edge: the plate's front (south-facing) half-ellipse dropped
// by WALL px — a thin darker side wall for depth.
function wallPath(project: ProjectFn): string {
  const pts: [number, number][] = []
  for (let a = 90; a <= 270; a += 4) {
    const [x, y] = planXY(a, 1.0)
    pts.push([...project(x, y)] as [number, number])
  }
  const top = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  const bottom = [...pts]
    .reverse()
    .map(([x, y]) => `L${x.toFixed(1)},${(y + WALL).toFixed(1)}`)
  return `${top.join(' ')} ${bottom.join(' ')} Z`
}

export interface StackViewProps {
  rings: RingSpec[]
  placements: LevelPlacements[]
  shades: Map<string, ItemShade>
  movedIds: Set<string>
  strips: Record<PlanLevelId, number[]>
  selectedIdx: number | null
  contIntensity: number
  contLabel: string
  callouts: CalloutSpec[]
  tall: boolean // panel collapsed — let the stack use more viewport height
  onItemClick: (ids: string[]) => void
  onHover: HoverHandler
}

export default function StackView({
  rings,
  placements,
  shades,
  movedIds,
  strips,
  selectedIdx,
  contIntensity,
  contLabel,
  callouts,
  tall,
  onItemClick,
  onHover,
}: StackViewProps) {
  const placementsByLevel = new Map(placements.map((p) => [p.level, p]))
  const ringsByLevel = new Map(rings.map((r) => [r.level, r]))

  // CONT/systems spine — slim vertical prism at the NE shoulder (~30°)
  // connecting all plates; washes with the selected window's systems spend.
  const spineHalf = 4 // degrees either side of 30°
  const pBottom = plateProject(0)
  const pTop = plateProject(PLAN_LEVELS.length - 1)
  const [sx0, sy0] = pBottom(...planXY(30 - spineHalf, 1.0))
  const [sx1, sy1] = pBottom(...planXY(30 + spineHalf, 1.0))
  const [tx1, ty1] = pTop(...planXY(30 + spineHalf, 1.0))
  const [tx0, ty0] = pTop(...planXY(30 - spineHalf, 1.0))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto block w-full"
      style={{ maxHeight: tall ? '85vh' : '52vh' }}
      role="img"
      aria-label="Exploded level stack"
    >
      {/* Systems spine behind the plates. */}
      <path
        d={`M ${sx0},${sy0} L ${sx1},${sy1} L ${tx1},${ty1} L ${tx0},${ty0} Z`}
        style={{
          fill: SYSTEMS_GOLD,
          fillOpacity: 0.2 + 0.55 * contIntensity,
          transition: 'fill-opacity 600ms ease',
        }}
        stroke={SYSTEMS_GOLD}
        strokeOpacity={0.6}
        strokeWidth={0.8}
        onMouseEnter={(e) => onHover(<SystemsTip selectedIdx={selectedIdx} />, e)}
        onMouseLeave={() => onHover(null)}
      />
      <text
        x={Math.max(tx0, tx1) + 10}
        y={Math.max(Math.min(ty0, ty1) + 4, 18)}
        fontSize={11}
        fontWeight={500}
        fill={SYSTEMS_GOLD}
      >
        Building Systems (continuous) · {contLabel}
      </text>

      {/* Plates rendered back-to-front (L700 first) so front edges overlap
          correctly; stack runs bottom→top L100→L700. */}
      {[...PLAN_LEVELS]
        .map((lvl, i) => ({ lvl, i }))
        .reverse()
        .map(({ lvl, i }) => {
          const project = plateProject(i)
          const cy = plateCy(i)
          const ring = ringsByLevel.get(lvl)
          const lp = placementsByLevel.get(lvl)
          const cells = strips[lvl]
          const labelX = CX - S - 118
          return (
            <g key={lvl}>
              {/* Side wall, then plate surface. */}
              <path d={wallPath(project)} fill="#cfd2cf" />
              <path d={ellipsePath(1.0, project)} fill="#fbfbfa" stroke="#c9ccc9" strokeWidth={1} />

              {/* The level's ring band + geometry on the plate surface. */}
              {ring && (
                <path
                  d={ellipsePath(ring.inner, project)}
                  fill="none"
                  stroke="#e4e6e3"
                  strokeWidth={0.8}
                />
              )}
              {ring && lp && (
                <LevelShapes
                  ring={ring}
                  placements={lp}
                  shades={shades}
                  movedIds={movedIds}
                  project={project}
                  onItemClick={onItemClick}
                  onHover={onHover}
                />
              )}
              {ring && (
                <path
                  d={ellipsePath(ring.outer, project)}
                  fill="none"
                  stroke="#d5d7d4"
                  strokeWidth={0.8}
                />
              )}

              {/* Court drawn on the L100 plate surface. */}
              {lvl === 'L100' && (
                <g pointerEvents="none">
                  <rect
                    x={CX - 0.1 * S}
                    y={cy - 0.152 * S * SQUASH}
                    width={0.2 * S}
                    height={0.304 * S * SQUASH}
                    rx={5}
                    fill="#f7f6f2"
                    stroke="#b9bcb8"
                    strokeWidth={1}
                  />
                  <line
                    x1={CX - 0.1 * S}
                    y1={cy}
                    x2={CX + 0.1 * S}
                    y2={cy}
                    stroke="#c9ccc9"
                    strokeWidth={0.8}
                  />
                  <path
                    d={ellipsePath(COURT_R, project)}
                    fill="none"
                    stroke="#e2e4e1"
                    strokeWidth={0.6}
                  />
                </g>
              )}

              {/* Level label + leader line at the plate's left edge, with the
                  six-cell window intensity strip. */}
              <g>
                <text x={labelX} y={cy + 3} fontSize={11} fontWeight={700} fill={LEVEL_ACCENT[lvl]}>
                  {LEVEL_NAMES[lvl]}
                </text>
                <line
                  x1={labelX + 92}
                  y1={cy}
                  x2={CX - S + 4}
                  y2={cy}
                  stroke="#c9ccc9"
                  strokeWidth={0.8}
                  strokeDasharray="2 3"
                />
                {cells.map((v, wi) => (
                  <rect
                    key={wi}
                    x={labelX + wi * 15}
                    y={cy + 9}
                    width={13}
                    height={9}
                    rx={1.5}
                    style={{ fill: stripCellFill(v, wi, selectedIdx), transition: 'fill 600ms ease' }}
                    stroke={selectedIdx === wi ? '#36383D' : '#d5d7d4'}
                    strokeWidth={selectedIdx === wi ? 1.4 : 0.6}
                    onMouseEnter={(e) =>
                      onHover(
                        <span className="font-medium">{`${SEQUENCE_WINDOWS[wi].label} — ${lvl} discrete spend intensity`}</span>,
                        e,
                      )
                    }
                    onMouseLeave={() => onHover(null)}
                  />
                ))}
              </g>
            </g>
          )
        })}

      {/* Leader-line callouts for the selected window's largest wedges (top
          layer) — anchors run through each plate's own projection so leaders
          track the 3D positions. Left slots sit between the plate label rows;
          the right gutter clears the spine caption. */}
      <CalloutLayer
        placed={callouts.map((c, li) => {
          const i = PLAN_LEVELS.indexOf(c.level)
          const ring = ringsByLevel.get(c.level)
          const lp = placementsByLevel.get(c.level)
          const placement = lp?.placed.find((p) => p.item.id === c.id)
          const anchor =
            placement && ring ? placementAnchor(placement, ring, plateProject(i)) : null
          // Distributed items anchor mid-band on their plate's SW arc,
          // staggered per callout so two bands never share a dot.
          return {
            spec: c,
            anchor:
              anchor ??
              (ring
                ? plateProject(i)(...planXY(205 + li * 18, (ring.inner + ring.outer) / 2))
                : ([CX + S * 0.5, plateCy(i) + PLATE_RY + 20 + li * 13] as const)),
          }
        })}
        centerX={CX}
        left={{ innerX: 196, slots: [310, 454, 598] }}
        right={{ innerX: 740, slots: [280, 420, 560] }}
      />

      {/* One shared N arrow beside the stack — north is the top-back of every
          plate. */}
      <g pointerEvents="none">
        <path d={`M ${CX - S - 40} 60 l 5 14 l -5 -4 l -5 4 Z`} fill="#36383D" />
        <text x={CX - S - 28} y={73} fontSize={12} fontWeight={700} fill="#36383D">
          N
        </text>
      </g>
    </svg>
  )
}
