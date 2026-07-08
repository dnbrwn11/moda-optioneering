import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { LEVEL_ACCENT, LEVEL_ORDER, levelChipStyle } from '../lib/levels'
import { TRADE_ACCENT, TRADE_ORDER, TRADE_SHORT, tradeChipStyle } from '../lib/trades'
import type { LevelId, Trade } from '../types'
import Board from './Board'
import ContinuousSection from './ContinuousSection'

type Density = 'detailed' | 'compact'

const HINT_TEXT =
  'Drag scope cards between phases to re-sequence the work — cost, escalation, and the headline recompute live.'

// 6-dot grip glyph reused in the hint.
function Grip() {
  return (
    <svg
      viewBox="0 0 8 12"
      aria-hidden
      className="h-3.5 w-2.5 shrink-0 text-pcl-green"
      fill="currentColor"
    >
      <circle cx="2" cy="2" r="1" />
      <circle cx="6" cy="2" r="1" />
      <circle cx="2" cy="6" r="1" />
      <circle cx="6" cy="6" r="1" />
      <circle cx="2" cy="10" r="1" />
      <circle cx="6" cy="10" r="1" />
    </svg>
  )
}

// On/off switch (view-only chrome).
function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-center gap-2 text-xs font-medium text-pcl-dark"
    >
      <span className="uppercase tracking-wider text-pcl-mid">{label}</span>
      <span
        className={`relative h-4 w-7 rounded-full transition-colors ${
          on ? 'bg-pcl-green' : 'bg-pcl-light'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
            on ? 'left-0.5 translate-x-3' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  )
}

export default function PhasingTab() {
  const items = useStore((s) => s.items)
  const [density, setDensity] = useState<Density>('compact')
  const [scopeToggles, setScopeToggles] = useState(false)
  const [activeLevels, setActiveLevels] = useState<Set<LevelId>>(new Set())
  const [activeTrades, setActiveTrades] = useState<Set<Trade>>(new Set())
  const [hintDismissed, setHintDismissed] = useState(false)

  const presentLevels = useMemo(() => {
    const present = new Set(items.map((it) => it.level))
    return LEVEL_ORDER.filter((l) => present.has(l))
  }, [items])
  const presentTrades = useMemo(() => {
    const present = new Set(items.map((it) => it.trade))
    return TRADE_ORDER.filter((t) => present.has(t))
  }, [items])

  function toggleLevel(level: LevelId) {
    setActiveLevels((prev) => {
      const next = new Set(prev)
      if (next.has(level)) next.delete(level)
      else next.add(level)
      return next
    })
  }
  function toggleTrade(trade: Trade) {
    setActiveTrades((prev) => {
      const next = new Set(prev)
      if (next.has(trade)) next.delete(trade)
      else next.add(trade)
      return next
    })
  }
  function clearAll() {
    setActiveLevels(new Set())
    setActiveTrades(new Set())
  }

  const filtering = activeLevels.size > 0 || activeTrades.size > 0

  return (
    <div className="pb-6">
      {/* Hint bar — dismissable; collapses to an ⓘ that reveals the text. */}
      <div className="px-6 pt-4">
        {hintDismissed ? (
          <button
            type="button"
            onClick={() => setHintDismissed(false)}
            title={HINT_TEXT}
            aria-label="Show board tip"
            className="flex h-6 w-6 items-center justify-center rounded-full border border-pcl-light text-pcl-mid transition-colors hover:border-pcl-green hover:text-pcl-green"
          >
            <span className="text-xs font-bold italic">i</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 rounded-md border border-l-4 border-[#cfe3d6] border-l-pcl-green bg-[#f0f7f2] px-3 py-2 text-[13px] text-pcl-dark">
            <Grip />
            <span className="flex-1">{HINT_TEXT}</span>
            <button
              type="button"
              onClick={() => setHintDismissed(true)}
              aria-label="Dismiss tip"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-pcl-mid transition-colors hover:bg-black/[0.05] hover:text-pcl-dark"
            >
              <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 3l6 6M9 3l-6 6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Single controls row — filters (left) · view toggles (right). */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 px-6 pt-3">
        <div className="flex flex-col gap-2">
          {/* LEVEL chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-10 text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
              Level
            </span>
            <button
              type="button"
              onClick={() => setActiveLevels(new Set())}
              aria-pressed={activeLevels.size === 0}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                activeLevels.size === 0
                  ? 'border-pcl-green bg-pcl-green text-white'
                  : 'border-pcl-light text-pcl-mid hover:text-pcl-dark'
              }`}
            >
              ALL
            </button>
            {presentLevels.map((level) => {
              const active = activeLevels.has(level)
              const hex = LEVEL_ACCENT[level]
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleLevel(level)}
                  aria-pressed={active}
                  className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors"
                  style={active ? { backgroundColor: hex, borderColor: hex, color: '#fff' } : levelChipStyle(level)}
                >
                  {level}
                </button>
              )
            })}
          </div>

          {/* TRADE chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 w-10 text-[11px] font-medium uppercase tracking-wider text-pcl-mid">
              Trade
            </span>
            <button
              type="button"
              onClick={() => setActiveTrades(new Set())}
              aria-pressed={activeTrades.size === 0}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                activeTrades.size === 0
                  ? 'border-pcl-green bg-pcl-green text-white'
                  : 'border-pcl-light text-pcl-mid hover:text-pcl-dark'
              }`}
            >
              ALL
            </button>
            {presentTrades.map((trade) => {
              const active = activeTrades.has(trade)
              const hex = TRADE_ACCENT[trade]
              return (
                <button
                  key={trade}
                  type="button"
                  onClick={() => toggleTrade(trade)}
                  aria-pressed={active}
                  title={trade}
                  className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors"
                  style={active ? { backgroundColor: hex, borderColor: hex, color: '#fff' } : tradeChipStyle(trade)}
                >
                  {TRADE_SHORT[trade]}
                </button>
              )
            })}
            {filtering && (
              <button
                type="button"
                onClick={clearAll}
                className="ml-1 flex items-center gap-1 rounded-full bg-pcl-green/10 px-2.5 py-0.5 text-[11px] font-medium text-pcl-green transition-colors hover:bg-pcl-green/20"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-pcl-green" aria-hidden />
                Filtered view · clear
              </button>
            )}
          </div>
        </div>

        {/* View toggles */}
        <div className="flex shrink-0 items-center gap-4">
          <Switch label="Scope toggles" on={scopeToggles} onChange={setScopeToggles} />
          <div className="inline-flex rounded border border-pcl-light p-0.5">
            {(['detailed', 'compact'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDensity(d)}
                aria-pressed={density === d}
                className={`rounded px-3 py-1 text-xs font-medium capitalize transition-colors ${
                  density === d
                    ? 'bg-pcl-green text-white'
                    : 'text-pcl-mid hover:text-pcl-dark'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Board
        compact={density === 'compact'}
        showToggles={scopeToggles}
        activeLevels={activeLevels}
        activeTrades={activeTrades}
      />
      <ContinuousSection
        showToggles={scopeToggles}
        activeLevels={activeLevels}
        activeTrades={activeTrades}
      />
    </div>
  )
}
