// 2D concentric-ring plan. Original schematic rendering — stylized nested
// ellipses (~1.25:1, wider E–W), not traced from any seating map. 0° = North
// at top, clockwise.
import { LEVEL_ACCENT } from '../../lib/levels'
import {
  annulusPath,
  COURT_R,
  ellipsePath,
  planXY,
  stripCellFill,
  SYSTEMS_GOLD,
} from '../../lib/sequence'
import type { ItemShade, LevelPlacements, ProjectFn, RingSpec } from '../../lib/sequence'
import { PLAN_LEVELS, SEQUENCE_WINDOWS } from '../../data/arenaGeometry'
import type { PlanLevelId } from '../../data/arenaGeometry'
import LevelShapes, { placementAnchor } from './RingShapes'
import CalloutLayer from './Callouts'
import { SystemsTip } from './SequenceTooltip'
import type { HoverHandler } from './SequenceTooltip'
import type { CalloutSpec } from './viewTypes'

const W = 960
const H = 680
const CX = 480
const CY = 336
const S = 296 // plan px per normalized radius (x); y gets /1.25 via planXY

const project: ProjectFn = (x, y) => [CX + x * S, CY + y * S]

export interface PlanViewProps {
  rings: RingSpec[]
  placements: LevelPlacements[]
  shades: Map<string, ItemShade>
  movedIds: Set<string>
  strips: Record<PlanLevelId, number[]>
  selectedIdx: number | null
  contIntensity: number
  contLabel: string
  callouts: CalloutSpec[]
  tall: boolean // panel collapsed — let the visual use more viewport height
  onItemClick: (ids: string[]) => void
  onHover: HoverHandler
}

export default function PlanView({
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
}: PlanViewProps) {
  const placementsByLevel = new Map(placements.map((p) => [p.level, p]))
  const ringsByLevel = new Map(rings.map((r) => [r.level, r]))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto block w-full"
      style={{ maxHeight: tall ? '64vh' : '52vh' }}
      role="img"
      aria-label="Schematic sequencing plan"
    >
      {/* Building Systems halo — hairline band outside L700, washing with the
          selected window's continuous spend. */}
      <path
        d={annulusPath(1.02, 1.07, project)}
        fillRule="evenodd"
        style={{
          fill: SYSTEMS_GOLD,
          fillOpacity: 0.1 + 0.4 * contIntensity,
          transition: 'fill-opacity 600ms ease',
        }}
        onMouseEnter={(e) => onHover(<SystemsTip selectedIdx={selectedIdx} />, e)}
        onMouseLeave={() => onHover(null)}
      />
      <path
        d={ellipsePath(1.07, project)}
        fill="none"
        stroke="#c9ccc9"
        strokeWidth={0.8}
        pointerEvents="none"
      />
      <path
        d={ellipsePath(1.02, project)}
        fill="none"
        stroke="#c9ccc9"
        strokeWidth={0.8}
        pointerEvents="none"
      />
      <text
        x={CX}
        y={CY + (1.07 * S) / 1.25 + 22}
        textAnchor="middle"
        fontSize={11}
        fontWeight={500}
        fill={SYSTEMS_GOLD}
      >
        Building Systems (continuous) · {contLabel}
      </text>

      {/* Ring fills (white base) + geometry, inner to outer. */}
      {rings.map((ring) => {
        const lp = placementsByLevel.get(ring.level)
        return (
          <g key={ring.level}>
            <path
              d={annulusPath(ring.inner, ring.outer, project)}
              fillRule="evenodd"
              fill="#fefefd"
            />
            {lp && (
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
            <path
              d={ellipsePath(ring.outer, project)}
              fill="none"
              stroke="#d5d7d4"
              strokeWidth={1}
              pointerEvents="none"
            />
          </g>
        )
      })}

      {/* Court — rounded rectangle, long axis N–S, center line suggested.
          Not a data surface. */}
      <g pointerEvents="none">
        <rect
          x={CX - 0.1 * S}
          y={CY - 0.152 * S}
          width={0.2 * S}
          height={0.304 * S}
          rx={8}
          fill="#f7f6f2"
          stroke="#b9bcb8"
          strokeWidth={1.2}
        />
        <line
          x1={CX - 0.1 * S}
          y1={CY}
          x2={CX + 0.1 * S}
          y2={CY}
          stroke="#c9ccc9"
          strokeWidth={1}
        />
        <circle cx={CX} cy={CY} r={0.032 * S} fill="none" stroke="#c9ccc9" strokeWidth={1} />
        <path d={ellipsePath(COURT_R, project)} fill="none" stroke="#e2e4e1" strokeWidth={0.8} />
      </g>

      {/* Leader-line callouts for the selected window's largest wedges —
          fixed gutters clear of the halo, legend and systems caption. */}
      <CalloutLayer
        placed={callouts.map((c, li) => {
          const ring = ringsByLevel.get(c.level)
          const lp = placementsByLevel.get(c.level)
          const placement = lp?.placed.find((p) => p.item.id === c.id)
          const anchor = placement && ring ? placementAnchor(placement, ring, project) : null
          // Distributed items anchor mid-band on their own ring's SW arc,
          // staggered per callout so two bands never share a dot.
          return {
            spec: c,
            anchor:
              anchor ??
              (ring
                ? project(...planXY(205 + li * 14, (ring.inner + ring.outer) / 2))
                : ([CX, CY + (0.6 * S) / 1.25 + li * 14] as const)),
          }
        })}
        centerX={CX}
        left={{ innerX: 168, slots: [428, 478, 528] }}
        right={{ innerX: 804, slots: [240, 336, 432] }}
      />

      {/* Compass — N at top-center. */}
      <g pointerEvents="none">
        <path d={`M ${CX} 12 l 5 14 l -5 -4 l -5 4 Z`} fill="#36383D" />
        <text x={CX + 12} y={25} fontSize={12} fontWeight={700} fill="#36383D">
          N
        </text>
      </g>

      {/* Level legend + six-cell intensity strips, left column. */}
      <g>
        {PLAN_LEVELS.map((lvl, i) => {
          const y = 96 + i * 44
          const cells = strips[lvl]
          return (
            <g key={lvl}>
              <rect x={16} y={y - 9} width={9} height={9} rx={2} fill={LEVEL_ACCENT[lvl]} />
              <text x={31} y={y} fontSize={11} fontWeight={500} fill="#36383D">
                {lvl === 'L100' ? 'L100 Event' : lvl === 'L200' ? 'L200 Concourse' : lvl === 'L300' ? 'L300 Club' : lvl === 'L400' ? 'L400 Suite' : lvl === 'L500' ? 'L500 Upper' : 'L700 Press'}
              </text>
              {cells.map((v, wi) => (
                <rect
                  key={wi}
                  x={16 + wi * 15}
                  y={y + 6}
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
          )
        })}
      </g>
    </svg>
  )
}
