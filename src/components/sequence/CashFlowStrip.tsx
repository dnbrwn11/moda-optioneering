// Compact cumulative escalated S-curve, synced to the scrubber. Shares the
// Analytics S-curve computed series (lib/analytics cashFlowCurve) — no
// duplicate data path. X-axis = the six windows (month-accurate widths),
// OS/DS bands shaded, playhead tracking the selected window and sweeping
// during Play with progressive curve emphasis.
import { useId } from 'react'
import type { Totals } from '../../lib/escalation'
import { cashFlowCurve, KIND_COLORS } from '../../lib/analytics'
import { fmtMillions } from '../../lib/format'
import { SEQUENCE_WINDOWS } from '../../data/arenaGeometry'
import type { HoverHandler } from './SequenceTooltip'

// Wide aspect so the strip stays short (~100px) at full panel width and the
// visual above it never has to scroll at 1080p.
const W = 1440
const H = 120
const PAD_L = 58
const PAD_R = 12
const PAD_T = 12
const PAD_B = 24

export interface CashFlowStripProps {
  totals: Totals
  selectedIdx: number | null
  progress: number // 0..1 within the selected window (sweeps during Play)
  onSelect: (idx: number) => void
  onHover: HoverHandler
}

export default function CashFlowStrip({
  totals,
  selectedIdx,
  progress,
  onSelect,
  onHover,
}: CashFlowStripProps) {
  const clipId = useId()
  const { points, bands, total, ticks } = cashFlowCurve(totals)
  const tMax = ticks[ticks.length - 1]
  const x = (t: number) => PAD_L + (t / tMax) * (W - PAD_L - PAD_R)
  const y = (cum: number) => H - PAD_B - (total > 0 ? cum / total : 0) * (H - PAD_T - PAD_B)

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.cum).toFixed(1)}`)
    .join(' ')

  // Playhead sweeps the selected window's band during Play.
  const band = selectedIdx !== null ? bands[selectedIdx] : null
  const playX = band ? x(band.start + (band.end - band.start) * progress) : null

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ maxHeight: 104 }}
      role="img"
      aria-label="Cumulative cash flow by window"
    >
      {/* OS/DS bands — click to select a window. */}
      {bands.map((b, i) => (
        <g
          key={i}
          className="cursor-pointer"
          onClick={() => onSelect(i)}
          onMouseEnter={(e) =>
            onHover(
              <div className="flex flex-col gap-0.5">
                <span className="font-bold">{SEQUENCE_WINDOWS[i].label}</span>
                <span className="text-pcl-mid">{SEQUENCE_WINDOWS[i].caption}</span>
                <span className="font-bold tabular-nums">
                  {fmtMillions(totals.phaseWithContinuous[SEQUENCE_WINDOWS[i].phase])}
                </span>
              </div>,
              e,
            )
          }
          onMouseLeave={() => onHover(null)}
        >
          <rect
            x={x(b.start)}
            y={PAD_T}
            width={x(b.end) - x(b.start)}
            height={H - PAD_T - PAD_B}
            fill={KIND_COLORS[b.kind]}
            fillOpacity={selectedIdx === i ? 0.22 : 0.09}
            style={{ transition: 'fill-opacity 300ms ease' }}
          />
          <text
            x={(x(b.start) + x(b.end)) / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize={12}
            fontWeight={selectedIdx === i ? 700 : 500}
            fill={selectedIdx === i ? KIND_COLORS[b.kind] : '#A6A6A6'}
          >
            {SEQUENCE_WINDOWS[i].label}
          </text>
        </g>
      ))}

      {/* Gridline at total + $ axis hints. */}
      <line x1={PAD_L} y1={y(total)} x2={W - PAD_R} y2={y(total)} stroke="#e2e4e1" strokeDasharray="4 4" />
      <text x={PAD_L - 6} y={y(total) + 4} textAnchor="end" fontSize={11} fill="#A6A6A6">
        {fmtMillions(total)}
      </text>
      <text x={PAD_L - 6} y={y(0) + 4} textAnchor="end" fontSize={11} fill="#A6A6A6">
        $0
      </text>

      {/* Full curve, muted; emphasized portion clipped to the playhead. */}
      <path d={path} fill="none" stroke="#c4ccc7" strokeWidth={1.5} pointerEvents="none" />
      {playX !== null ? (
        <>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={playX} height={H} />
          </clipPath>
          <path
            d={path}
            fill="none"
            stroke="#005D2F"
            strokeWidth={2.5}
            clipPath={`url(#${clipId})`}
            pointerEvents="none"
          />
          <line x1={playX} y1={PAD_T} x2={playX} y2={H - PAD_B} stroke="#36383D" strokeWidth={1.2} pointerEvents="none" />
          <circle cx={playX} cy={PAD_T - 4} r={3} fill="#36383D" pointerEvents="none" />
        </>
      ) : (
        <path d={path} fill="none" stroke="#005D2F" strokeWidth={2} strokeOpacity={0.65} pointerEvents="none" />
      )}
    </svg>
  )
}
