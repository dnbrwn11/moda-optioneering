// Sequence tab — schematic build-order view of the 51 discrete scopes.
// 3D exploded stack (default) / 2D concentric-ring plan, driven by the same
// live store state as every other tab: escalation sliders and phase
// assignments recompute everything here on the fly.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../../store'
import { useRefPhaseById, useTotals } from '../../lib/selectors'
import { escalatedCost } from '../../lib/escalation'
import { fmtMillions } from '../../lib/format'
import {
  computeRings,
  computeShades,
  computeWindowStats,
  contWashByWindow,
  levelWindowMatrix,
  resolvePlacements,
} from '../../lib/sequence'
import {
  GEOMETRY_BY_ID,
  SCHEMATIC_FOOTNOTE,
  SEQUENCE_WINDOWS,
} from '../../data/arenaGeometry'
import PlanView from './PlanView'
import StackView from './StackView'
import Scrubber from './Scrubber'
import CashFlowStrip from './CashFlowStrip'
import WindowPanel, { CollapsedWindowCard } from './WindowPanel'
import { FloatingTooltip } from './SequenceTooltip'
import type { TipState } from './SequenceTooltip'
import type { CalloutSpec } from './viewTypes'

type ViewMode = 'stack' | 'plan'

const PLAY_MS = 1500 // auto-advance cadence per window

// Panel collapse defaults per view (expanded in 2D Plan, collapsed in 3D
// Stack); the user's choice persists per view for the session.
const PANEL_COLLAPSE_KEY = 'seq-panel-collapsed'
const DEFAULT_COLLAPSED: Record<ViewMode, boolean> = { plan: false, stack: true }

function loadCollapsed(): Record<ViewMode, boolean> {
  try {
    const raw = sessionStorage.getItem(PANEL_COLLAPSE_KEY)
    if (raw) return { ...DEFAULT_COLLAPSED, ...(JSON.parse(raw) as Partial<Record<ViewMode, boolean>>) }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_COLLAPSED
}

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const opts: { id: ViewMode; label: string }[] = [
    { id: 'stack', label: '3D Stack' },
    { id: 'plan', label: '2D Plan' },
  ]
  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-line">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
            view === o.id ? 'bg-accent text-white' : 'bg-white text-ink-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export default function SequenceTab() {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  // Moved-item markers reference the comparison scenario when Compare is on,
  // the Baseline assignments otherwise.
  const refPhaseById = useRefPhaseById()
  const totals = useTotals()

  const [view, setView] = useState<ViewMode>('plan')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(1) // playhead position in window
  const [detailIds, setDetailIds] = useState<string[] | null>(null)
  // Single floating hover tooltip (suppressed while Play animates).
  const [tip, setTip] = useState<TipState | null>(null)
  // Right-panel collapse, per view. A wedge click while collapsed temporarily
  // expands the panel (tempExpanded) until the scope detail is closed.
  const [collapsedByView, setCollapsedByView] = useState<Record<ViewMode, boolean>>(loadCollapsed)
  const [tempExpanded, setTempExpanded] = useState(false)

  const setCollapsed = (v: ViewMode, value: boolean) => {
    setTempExpanded(false)
    setCollapsedByView((prev) => {
      const next = { ...prev, [v]: value }
      try {
        sessionStorage.setItem(PANEL_COLLAPSE_KEY, JSON.stringify(next))
      } catch {
        // session-only nicety — ignore storage failures
      }
      return next
    })
  }

  const collapsed = collapsedByView[view] && !tempExpanded

  const selRef = useRef(selectedIdx)
  selRef.current = selectedIdx

  const onHover = (content: React.ReactNode | null, e?: React.MouseEvent) => {
    if (content && e) setTip({ content, x: e.clientX, y: e.clientY })
    else setTip(null)
  }

  // The hovered shape can change identity under the cursor when the window
  // changes — drop any open tooltip rather than show a stale card.
  useEffect(() => {
    setTip(null)
  }, [selectedIdx, view])

  // Play loop — ~1.5s per window, sweeping the cash-flow playhead, then
  // advancing. Stops at 3rd DS.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let windowStart = performance.now()
    const step = (t: number) => {
      const p = (t - windowStart) / PLAY_MS
      if (p >= 1) {
        const cur = selRef.current
        if (cur === null || cur >= SEQUENCE_WINDOWS.length - 1) {
          setPlaying(false)
          setProgress(1)
          return
        }
        setSelectedIdx(cur + 1)
        windowStart = t
        setProgress(0)
      } else {
        setProgress(p)
      }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [playing])

  // Any interaction pauses playback (spec) — playhead parks at window end.
  const pause = () => {
    setPlaying(false)
    setProgress(1)
  }

  const togglePlay = () => {
    if (playing) {
      pause()
      return
    }
    if (selectedIdx === null || selectedIdx >= SEQUENCE_WINDOWS.length - 1) setSelectedIdx(0)
    setProgress(0)
    setTip(null) // tooltips are suppressed while Play animates
    setPlaying(true)
  }

  const selectWindow = (idx: number | null) => {
    pause()
    setSelectedIdx(idx)
  }

  const onItemClick = (ids: string[]) => {
    pause()
    setDetailIds(ids)
    // Collapsed panel: surface the scope detail by temporarily expanding.
    if (collapsedByView[view]) setTempExpanded(true)
  }

  const onCloseDetail = () => {
    setDetailIds(null)
    setTempExpanded(false) // re-collapse if the expand was click-triggered
  }

  // ── Live derivations ──────────────────────────────────────────────────────
  const selectedWindow = selectedIdx !== null ? SEQUENCE_WINDOWS[selectedIdx] : null
  const rings = useMemo(() => computeRings(items), [items])
  const placements = useMemo(() => resolvePlacements(items), [items])
  const shades = useMemo(
    () => computeShades(items, rates, selectedWindow),
    [items, rates, selectedWindow],
  )
  const stats = useMemo(
    () => (selectedWindow ? computeWindowStats(items, rates, totals, selectedWindow) : null),
    [items, rates, totals, selectedWindow],
  )
  const strips = useMemo(() => levelWindowMatrix(items, rates), [items, rates])
  const contWash = useMemo(() => contWashByWindow(totals), [totals])

  const movedIds = useMemo(
    () =>
      new Set(
        items
          .filter((it) => refPhaseById[it.id] !== undefined && it.phase !== refPhaseById[it.id])
          .map((it) => it.id),
      ),
    [items, refPhaseById],
  )

  // Gutter callouts: only the 3 largest wedges of the selected window —
  // legibility on a projector beats density. None in the ALL view.
  const callouts = useMemo<CalloutSpec[]>(() => {
    if (!selectedWindow) return []
    return items
      .filter((it) => it.included && it.phase === selectedWindow.phase && it.id in GEOMETRY_BY_ID)
      .map((it) => ({ it, spend: escalatedCost(it, rates) }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 3)
      .map(({ it, spend }) => ({
        id: it.id,
        level: GEOMETRY_BY_ID[it.id].level,
        name: it.name.length > 24 ? `${it.name.slice(0, 23)}…` : it.name,
        money: fmtMillions(spend),
      }))
  }, [items, rates, selectedWindow])

  const contIntensity = selectedWindow ? contWash[selectedWindow.phase] : 0.3
  const contLabel = selectedWindow
    ? `${fmtMillions(stats?.contInWindow ?? 0)} systems this window`
    : `${fmtMillions(totals.continuousTotal)} systems across program`

  const viewProps = {
    rings,
    placements,
    shades,
    movedIds,
    strips,
    selectedIdx,
    contIntensity,
    contLabel,
    callouts,
    tall: collapsed,
    onItemClick,
    onHover,
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Scrubber
          selectedIdx={selectedIdx}
          playing={playing}
          onSelect={selectWindow}
          onTogglePlay={togglePlay}
        />
        <ViewToggle
          view={view}
          onChange={(v) => {
            pause()
            setTempExpanded(false)
            setView(v)
          }}
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Visual + synced cash-flow strip. Any pointer-down pauses Play.
            With the panel collapsed the section takes the full row and the
            compact window card floats over the canvas top-right. */}
        <section
          className="relative min-w-0 flex-1 rounded-lg border border-line bg-white p-3"
          onPointerDownCapture={() => {
            if (playing) pause()
          }}
        >
          {view === 'stack' ? <StackView {...viewProps} /> : <PlanView {...viewProps} />}
          {/* Synced cumulative S-curve — directly beneath the visual so it is
              always in view at 1080p (both svgs are height-capped). */}
          <div className="mt-1 border-t border-line/60 pt-2">
            <CashFlowStrip
              totals={totals}
              selectedIdx={selectedIdx}
              progress={progress}
              onSelect={(i) => selectWindow(i)}
              onHover={onHover}
            />
          </div>
          <p className="mt-2 text-[10px] font-light italic text-ink-muted">{SCHEMATIC_FOOTNOTE}</p>
          {collapsed && (
            <CollapsedWindowCard
              stats={stats}
              totals={totals}
              onExpand={() => setCollapsed(view, false)}
            />
          )}
        </section>

        {!collapsed && (
          <div className="w-full lg:w-[35%] lg:shrink-0">
            <WindowPanel
              stats={stats}
              totals={totals}
              items={items}
              rates={rates}
              refPhaseById={refPhaseById}
              detailIds={detailIds}
              onCloseDetail={onCloseDetail}
              onCollapse={() => setCollapsed(view, true)}
            />
          </div>
        )}
      </div>

      {/* The one floating tooltip instance — portaled to the app root,
          suppressed entirely while Play is animating. */}
      <FloatingTooltip tip={playing ? null : tip} />
    </div>
  )
}
