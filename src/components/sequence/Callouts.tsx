// External leader-line callouts — the selected window's top wedges labeled in
// fixed gutters left and right of the visual, each connected to its wedge by a
// thin 1px leader ending in a small anchor dot. Side is chosen by anchor
// position; fixed vertical slots guarantee callouts never overlap the visual
// or each other. All other wedge info stays hover-only (see SequenceTooltip).
import type { CalloutSpec } from './viewTypes'

export interface PlacedCallout {
  spec: CalloutSpec
  anchor: readonly [number, number]
}

export interface GutterSpec {
  innerX: number // gutter edge nearest the visual — text grows away from it
  slots: number[] // fixed name-baseline y positions, top to bottom
}

export default function CalloutLayer({
  placed,
  centerX,
  left,
  right,
}: {
  placed: PlacedCallout[]
  centerX: number
  left: GutterSpec
  right: GutterSpec
}) {
  const renderSide = (side: 'left' | 'right', gutter: GutterSpec) => {
    const anchorAlign = side === 'left' ? 'end' : 'start'
    return placed
      .filter((p) => (side === 'left' ? p.anchor[0] <= centerX : p.anchor[0] > centerX))
      .sort((a, b) => a.anchor[1] - b.anchor[1])
      .slice(0, gutter.slots.length)
      .map((p, i) => {
        const yBase = gutter.slots[i]
        const leadX = side === 'left' ? gutter.innerX + 6 : gutter.innerX - 6
        return (
          <g key={p.spec.id} pointerEvents="none">
            <line
              x1={leadX}
              y1={yBase + 4}
              x2={p.anchor[0]}
              y2={p.anchor[1]}
              stroke="#9aa09b"
              strokeWidth={1}
            />
            <circle cx={p.anchor[0]} cy={p.anchor[1]} r={2.5} fill="#36383D" />
            <text
              x={gutter.innerX}
              y={yBase}
              textAnchor={anchorAlign}
              fontSize={11}
              fontWeight={700}
              fill="#36383D"
            >
              {p.spec.name}
            </text>
            <text
              x={gutter.innerX}
              y={yBase + 14}
              textAnchor={anchorAlign}
              fontSize={11}
              fontWeight={700}
              fill="#005D2F"
            >
              {p.spec.money}
            </text>
          </g>
        )
      })
  }

  return (
    <g>
      {renderSide('left', left)}
      {renderSide('right', right)}
    </g>
  )
}
