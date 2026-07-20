// Shared per-level shape rendering for the Sequence views. Both the 2D plan
// and the 3D stack call this with their own ProjectFn, so wedge geometry,
// shading, hover, click targets and moved-item ticks stay identical across
// views — only the projection differs.
//
// Hover feedback goes through the single floating React tooltip (see
// SequenceTooltip) via the onHover handler — no SVG <title> elements.
import type { Item } from '../../types'
import { LEVEL_ACCENT } from '../../lib/levels'
import {
  annulusPath,
  COMPLETED_GRAY,
  COURTSIDE_BAND,
  planXY,
  wedgeCentroid,
  wedgePath,
  wedgeRadii,
} from '../../lib/sequence'
import type {
  ItemShade,
  LevelPlacements,
  Placement,
  ProjectFn,
  RingSpec,
} from '../../lib/sequence'
import { DistributedTip, ItemTip } from './SequenceTooltip'
import type { HoverHandler } from './SequenceTooltip'
import { color as C, seq as SEQ } from '../../lib/tokens'

// Transitions run on fill/opacity only — elements keep stable keys, so window
// scrubbing animates smoothly instead of re-mounting.
const FILL_TRANSITION =
  'fill 600ms ease, fill-opacity 600ms ease, opacity 600ms ease, stroke-opacity 600ms ease'

// Aggregate shade for a ring's distributed tint band.
function distributedFill(
  items: Item[],
  shades: Map<string, ItemShade>,
): { fill: string; opacity: number } {
  let best: ItemShade | null = null
  let anyCompleted = false
  for (const it of items) {
    const s = shades.get(it.id)
    if (!s) continue
    if (s.state === 'active' && (!best || s.spend > best.spend)) best = s
    if (s.state === 'completed') anyCompleted = true
  }
  if (best) return { fill: best.fill, opacity: 0.5 }
  if (anyCompleted) return { fill: COMPLETED_GRAY, opacity: 0.45 }
  return { fill: '#ffffff', opacity: 0 }
}

export interface LevelShapesProps {
  ring: RingSpec
  placements: LevelPlacements
  shades: Map<string, ItemShade>
  movedIds: Set<string>
  project: ProjectFn
  onItemClick: (ids: string[]) => void
  onHover: HoverHandler
}

// Anchor point for static labels / detail callouts on a placement.
export function placementAnchor(
  placement: Placement,
  ring: RingSpec,
  project: ProjectFn,
): readonly [number, number] {
  const [r0, r1] = wedgeRadii(ring)
  if (placement.kind === 'annular') {
    const depth = ring.outer - ring.inner
    const rMid = ring.inner + (depth * COURTSIDE_BAND) / 2
    const [x, y] = planXY(180, rMid)
    return project(x, y)
  }
  // Largest arc gets the label.
  const arc = [...placement.arcs].sort((a, b) => b.end - b.start - (a.end - a.start))[0]
  return wedgeCentroid(arc.start, arc.end, r0, r1, project)
}

export default function LevelShapes({
  ring,
  placements,
  shades,
  movedIds,
  project,
  onItemClick,
  onHover,
}: LevelShapesProps) {
  const [r0, r1] = wedgeRadii(ring)
  const accent = LEVEL_ACCENT[ring.level]
  const depth = ring.outer - ring.inner

  const distFill = distributedFill(placements.distributed, shades)
  const distMoved = placements.distributed.some((it) => movedIds.has(it.id))
  const distIds = placements.distributed.map((it) => it.id)

  return (
    <g>
      {/* Distributed tint — fills the ring's remaining arc beneath wedges. */}
      {placements.distributed.length > 0 && (
        <path
          d={annulusPath(r0, r1, project)}
          fillRule="evenodd"
          data-distributed={ring.level}
          style={{ fill: distFill.fill, fillOpacity: distFill.opacity, transition: FILL_TRANSITION }}
          className="cursor-pointer"
          onClick={() => onItemClick(distIds)}
          onMouseEnter={(e) => onHover(<DistributedTip ids={distIds} />, e)}
          onMouseLeave={() => onHover(null)}
        />
      )}

      {/* Located / semi shapes. */}
      {placements.placed.map((p) => {
        const shade = shades.get(p.item.id)
        const semi = p.geo.treatment === 'semi'
        const fill = shade?.fill ?? '#ffffff'
        const fillOpacity = semi ? 0.55 : 1
        const stroke = shade?.state === 'excluded' ? SEQ.structure.excludedStroke : accent
        const strokeOpacity = shade?.strokeOpacity ?? 1
        // Future windows under a selection: faint 1px outline, near-white fill.
        const strokeWidth = shade?.state === 'future' && strokeOpacity < 1 ? 1 : 0.8
        const paths =
          p.kind === 'annular'
            ? [
                annulusPath(
                  ring.inner + depth * 0.04,
                  ring.inner + depth * (COURTSIDE_BAND - 0.02),
                  project,
                ),
              ]
            : p.arcs.map((a) => wedgePath(a.start, a.end, r0, r1, project))
        return (
          <g key={p.item.id}>
            {paths.map((d, i) => (
              <path
                key={i}
                d={d}
                data-item-id={p.item.id}
                fillRule={p.kind === 'annular' ? 'evenodd' : 'nonzero'}
                style={{ fill, fillOpacity, strokeOpacity, transition: FILL_TRANSITION }}
                stroke={stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={semi ? '3 2' : undefined}
                className="cursor-pointer"
                onClick={() => onItemClick([p.item.id])}
                onMouseEnter={(e) => onHover(<ItemTip id={p.item.id} />, e)}
                onMouseLeave={() => onHover(null)}
              />
            ))}
            {/* Moved-item tick: phase differs from its baseline assignment. */}
            {movedIds.has(p.item.id) && <MovedTick placement={p} ring={ring} project={project} />}
          </g>
        )
      })}
      {distMoved && placements.distributed.length > 0 && (
        <DistributedMovedTick ring={ring} project={project} />
      )}
    </g>
  )
}

function Tick({ x, y }: { x: number; y: number }) {
  return (
    <path
      d={`M ${x},${y - 4} L ${x + 4},${y} L ${x},${y + 4} L ${x - 4},${y} Z`}
      fill={C.brandYellow}
      stroke={C.brandYellowInk}
      strokeWidth={0.6}
      pointerEvents="none"
    />
  )
}

function MovedTick({
  placement,
  ring,
  project,
}: {
  placement: Placement
  ring: RingSpec
  project: ProjectFn
}) {
  const [x, y] = placementAnchor(placement, ring, project)
  return <Tick x={x} y={y} />
}

function DistributedMovedTick({ ring, project }: { ring: RingSpec; project: ProjectFn }) {
  const [r0, r1] = wedgeRadii(ring)
  const [x, y] = planXY(155, (r0 + r1) / 2)
  const [px, py] = project(x, y)
  return <Tick x={px} y={py} />
}
