import { useEffect, useMemo } from 'react'
import { useStore } from '../store'
import { useTotals } from '../lib/selectors'
import { TIME_PHASES } from '../lib/phases'
import { KIND_COLORS } from '../lib/analytics'
import { tradeWindowSpend, windowHours } from '../lib/resources'
import {
  DELIVERY_CONDITIONS,
  DELIVERY_NOTE,
  PARTICIPATION_CAPTION,
  PROGRAM_GOAL_LABEL,
  participationRollup,
  participationRows,
  workforceSummary,
} from '../lib/participation'
import { TRADE_ACCENT } from '../lib/trades'
import type { PhaseId, Trade } from '../types'
import { fmtDeltaMillions, fmtMillions, fmtPct } from '../lib/format'
import { color as TOKEN } from '../lib/tokens'

const AGING: Trade = 'Aging Assets (Owner Decision)'

// Whole hours with locale commas — parametric figures, hence the ~.
const fmtHours = (h: number) => `~${Math.round(h).toLocaleString('en-US')}`

// Whole people — the Resources crew-matrix ~N idiom.
const fmtPeople = (n: number) => `~${Math.round(n)}`

// Signed percentage-point delta, e.g. "+2.3 pts" / "−1.1 pts".
function fmtDeltaPoints(fraction: number): string {
  const sign = fraction > 0 ? '+' : fraction < 0 ? '-' : ''
  return `${sign}${(Math.abs(fraction) * 100).toFixed(1)} pts`
}

// Editable percent field — the ResourcesTab NumInput idiom, displayed as a
// whole percent but stored as a 0–1 fraction (the fmtPct convention).
function PctInput({
  value,
  onChange,
  disabled = false,
}: {
  value: number // fraction 0–1
  onChange: (fraction: number) => void
  disabled?: boolean
}) {
  return (
    <span
      className={`inline-flex items-baseline gap-1 rounded border border-line bg-white px-2 py-1 focus-within:border-accent ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <input
        type="number"
        value={Math.round(value * 100)}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n / 100)
        }}
        className="w-12 bg-transparent text-right text-sm font-bold tabular-nums text-ink outline-none"
      />
      <span className="text-xs font-medium text-ink-muted">%</span>
    </span>
  )
}

export default function ParticipationTab() {
  const items = useStore((s) => s.items)
  const rates = useStore((s) => s.rates)
  const fractions = useStore((s) => s.laborFractions)
  const g = useStore((s) => s.laborGlobals)
  const participation = useStore((s) => s.participation)
  const setTradePct = useStore((s) => s.setTradeParticipationPct)
  const setGlobal = useStore((s) => s.setParticipationGlobal)
  const reset = useStore((s) => s.resetParticipation)
  const totals = useTotals()

  // Same trade-dimension engine as the Resources crew matrix.
  const spendByTrade = useMemo(() => tradeWindowSpend(items, rates), [items, rates])

  const rows = useMemo(() => {
    const built = participationRows(spendByTrade, participation.tradePct)
    return built.sort((a, b) => {
      if (a.trade === AGING) return 1
      if (b.trade === AGING) return -1
      return b.subcontract - a.subcontract
    })
  }, [spendByTrade, participation.tradePct])

  const rollup = useMemo(
    () => participationRollup(rows, participation.programGoal),
    [rows, participation.programGoal],
  )

  const workforce = useMemo(
    () =>
      workforceSummary(
        spendByTrade,
        fractions,
        g.blendedRate,
        participation.apprenticePct,
        participation.localHirePct,
      ),
    [spendByTrade, fractions, g.blendedRate, participation.apprenticePct, participation.localHirePct],
  )

  // --- Reconciliation: trade subcontract $ must foot to the headline -------
  const reconciles = Math.abs(rollup.totalSubcontract - totals.escalatedTotal) < 1

  useEffect(() => {
    /* eslint-disable no-console */
    console.log(
      '%c[Moda Optioneering] participation reconciliation',
      `color:${TOKEN.accent};font-weight:700`,
    )
    console.log(
      `%cTrade subcontract $ = ${fmtMillions(rollup.totalSubcontract)}  ${
        reconciles ? '✓ reconciles' : '✗ MISMATCH'
      } (headline ${fmtMillions(totals.escalatedTotal)})`,
      `color:${reconciles ? TOKEN.accent : TOKEN.alert};font-weight:700`,
    )
    /* eslint-enable no-console */
  }, [rollup.totalSubcontract, reconciles, totals.escalatedTotal])

  const apprenticeYears = workforce.apprenticeYears

  // Headcount view of the same hours — the Resources crew-matrix conversion
  // (windowHours: window months × weeks/month × crew-week hrs), avg over the
  // program's total workable hours, peak = max implied headcount per window.
  const headcounts = useMemo(() => {
    const programWorkable = TIME_PHASES.reduce(
      (s, p) => s + windowHours(p.id, g.crewWeekHrs),
      0,
    )
    const per = (hours: number) =>
      programWorkable > 0 ? Math.round(hours / programWorkable) : 0
    const peakOf = (pick: (w: (typeof workforce.windows)[number]) => number) =>
      Math.round(
        workforce.windows.reduce((m, w) => {
          const wh = windowHours(w.phase.id, g.crewWeekHrs)
          return Math.max(m, wh > 0 ? pick(w) / wh : 0)
        }, 0),
      )
    return {
      apprenticeAvg: per(workforce.apprenticeHours),
      apprenticePeak: peakOf((w) => w.apprenticeHours),
      localAvg: per(workforce.localHours),
      localPeak: peakOf((w) => w.localHours),
    }
  }, [workforce, g.crewWeekHrs])

  // Hours in one window → window-average people, guarded like crewCell.
  const impliedPeople = (hours: number, phase: PhaseId) => {
    const wh = windowHours(phase, g.crewWeekHrs)
    return wh > 0 ? hours / wh : 0
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      {/* 1 · Assumptions panel ------------------------------------------- */}
      <section className="rounded-lg border border-line bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
              Participation Assumptions
            </h3>
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
              editable
            </span>
          </div>
          <button
            type="button"
            onClick={reset}
            className="shrink-0 rounded border border-accent px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white"
          >
            Reset to defaults
          </button>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Program goal
            </span>
            <PctInput
              value={participation.programGoal}
              onChange={(v) => setGlobal('programGoal', v)}
            />
            <span className="text-[10px] font-light italic text-ink-muted">
              {PROGRAM_GOAL_LABEL}
            </span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Apprenticeship
            </span>
            <PctInput
              value={participation.apprenticePct}
              onChange={(v) => setGlobal('apprenticePct', v)}
            />
            <span className="text-[10px] font-light text-ink-muted">of craft hours</span>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Local hire
            </span>
            <PctInput
              value={participation.localHirePct}
              onChange={(v) => setGlobal('localHirePct', v)}
            />
            <span className="text-[10px] font-light text-ink-muted">of craft hours</span>
          </label>
        </div>
      </section>

      {/* 2 · Trade participation table ----------------------------------- */}
      <section className="rounded-lg border border-line bg-white p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
            COBID Participation by Trade Package
          </h3>
          <span
            className={`text-[11px] font-medium tabular-nums ${
              reconciles ? 'text-ink-muted' : 'text-alert'
            }`}
          >
            trade $ {reconciles ? 'reconciles to' : '✗ vs'}{' '}
            {fmtMillions(totals.escalatedTotal)}
          </span>
        </div>
        <p className="mb-3 text-[11px] font-light text-ink-muted">
          Escalated subcontract $ per package × achievable certified share.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3 text-left font-medium uppercase tracking-wider text-ink-muted">
                  Trade package
                </th>
                <th className="px-2 py-2 text-right font-medium uppercase tracking-wider text-ink-muted">
                  Escalated subcontract
                </th>
                <th className="px-2 py-2 text-right font-medium uppercase tracking-wider text-ink-muted">
                  Achievable COBID %
                </th>
                <th className="px-2 py-2 text-right font-medium uppercase tracking-wider text-ink-muted">
                  Projected certified $
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const inert = r.trade === AGING
                return (
                  <tr
                    key={r.trade}
                    className={`border-b border-line/60 ${inert ? 'opacity-50' : ''}`}
                  >
                    <td className="py-1.5 pr-3">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: TRADE_ACCENT[r.trade] }}
                          aria-hidden
                        />
                        <span className="font-medium text-ink">{r.trade}</span>
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-ink">
                      {r.subcontract > 0 ? (
                        fmtMillions(r.subcontract)
                      ) : (
                        <span className="text-line">·</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <PctInput
                        value={r.pct}
                        onChange={(v) => setTradePct(r.trade, v)}
                        disabled={inert}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right font-bold tabular-nums text-ink">
                      {r.certified > 0 ? (
                        fmtMillions(r.certified)
                      ) : (
                        <span className="font-normal text-line">·</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Program rollup band */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-md border border-line bg-black/[0.02] px-4 py-3">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-xs text-ink-muted">
              Projected certified{' '}
              <span className="text-base font-bold tabular-nums text-ink">
                {fmtMillions(rollup.totalCertified)}
              </span>
            </span>
            <span className="text-xs text-ink-muted">
              Program-wide{' '}
              <span className="text-base font-bold tabular-nums text-ink">
                {fmtPct(rollup.programPct)}
              </span>
            </span>
            <span className="text-xs text-ink-muted">
              Goal{' '}
              <span className="text-base font-bold tabular-nums text-ink">
                {fmtPct(rollup.goal, 0)}
              </span>
            </span>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              rollup.onTrack
                ? 'bg-accent/10 text-accent'
                : 'bg-alert/10 text-alert'
            }`}
          >
            {rollup.onTrack ? 'On track' : 'Gap'} · {fmtDeltaMillions(rollup.gapDollars)} ·{' '}
            {fmtDeltaPoints(rollup.gapPoints)}
          </span>
        </div>
      </section>

      {/* 3 · Workforce projection ---------------------------------------- */}
      <section className="rounded-lg border border-line bg-white p-4">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-accent">
          Workforce Projection
        </h3>

        <div className="mb-4 grid grid-cols-1 divide-y divide-line rounded-md border border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="flex flex-col justify-center px-5 py-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Total program craft hours
            </span>
            <span className="mt-1 text-2xl font-bold leading-none tabular-nums text-accent">
              {fmtHours(workforce.totalHours)}
            </span>
            <span className="mt-1 text-xs font-light text-ink">
              trade labor $ ÷ ${g.blendedRate}/hr blended rate
            </span>
          </div>
          <div className="flex flex-col justify-center px-5 py-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Apprentice hours · {fmtPct(participation.apprenticePct, 0)}
            </span>
            <span className="mt-1 text-2xl font-bold leading-none tabular-nums text-accent">
              {fmtHours(workforce.apprenticeHours)}
            </span>
            <span className="mt-1 text-xs font-light text-ink">
              ≈ {apprenticeYears >= 10 ? Math.round(apprenticeYears) : apprenticeYears.toFixed(1)}{' '}
              apprentice-years at 2,000 hrs/yr
            </span>
            <span className="text-xs font-light text-ink">
              ≈ {headcounts.apprenticeAvg} apprentices on site (avg) · peak window ~
              {headcounts.apprenticePeak}
            </span>
          </div>
          <div className="flex flex-col justify-center px-5 py-3">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
              Local-hire hours · {fmtPct(participation.localHirePct, 0)}
            </span>
            <span className="mt-1 text-2xl font-bold leading-none tabular-nums text-accent">
              {fmtHours(workforce.localHours)}
            </span>
            <span className="mt-1 text-xs font-light text-ink">
              of craft hours worked by local residents
            </span>
            <span className="text-xs font-light text-ink">
              ≈ {headcounts.localAvg} local-hire workers on site (avg) · peak window ~
              {headcounts.localPeak}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-line">
                <th className="py-2 pr-3 text-left font-medium uppercase tracking-wider text-ink-muted">
                  Hours
                </th>
                {TIME_PHASES.map((p) => (
                  <th
                    key={p.id}
                    className="px-2 py-2 text-center font-medium text-ink"
                    style={{
                      borderTop: `2px solid ${KIND_COLORS[p.kind as 'offseason' | 'during-season']}`,
                    }}
                  >
                    {p.short}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Craft', (w: (typeof workforce.windows)[number]) => w.craftHours, fmtHours],
                  [
                    'Apprentice',
                    (w: (typeof workforce.windows)[number]) => w.apprenticeHours,
                    fmtHours,
                  ],
                  ['Local hire', (w: (typeof workforce.windows)[number]) => w.localHours, fmtHours],
                  [
                    '≈ Apprentices (avg on site)',
                    (w: (typeof workforce.windows)[number]) =>
                      impliedPeople(w.apprenticeHours, w.phase.id),
                    fmtPeople,
                  ],
                  [
                    '≈ Local-hire workers (avg on site)',
                    (w: (typeof workforce.windows)[number]) =>
                      impliedPeople(w.localHours, w.phase.id),
                    fmtPeople,
                  ],
                ] as const
              ).map(([label, pick, fmt]) => (
                <tr key={label} className="border-b border-line/60">
                  <td className="py-1.5 pr-3 font-medium text-ink">{label}</td>
                  {workforce.windows.map((w) => {
                    const v = pick(w)
                    return (
                      <td
                        key={w.phase.id}
                        className="px-2 py-1.5 text-center tabular-nums text-ink"
                      >
                        {v >= 0.5 ? fmt(v) : <span className="text-line">·</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[11px] font-light text-ink-muted">
          Hours = trade labor $ ÷ blended craft rate (${g.blendedRate}/hr) from the
          Resources staffing assumptions. Peak factor affects crew counts, not hours.
          Headcounts are window-average full-time-equivalent people at {g.crewWeekHrs}{' '}
          hrs/week — consistent with the Resources crew model.
        </p>
      </section>

      {/* 4 · Delivery conditions (Exhibit C) ----------------------------- */}
      <section className="rounded-lg border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-accent">
            Delivery Conditions
          </h3>
          {DELIVERY_CONDITIONS.map((c) => (
            <span
              key={c}
              className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent"
            >
              {c}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] font-light text-ink-muted">{DELIVERY_NOTE}</p>
      </section>

      {/* 5 · Caption ------------------------------------------------------ */}
      <p className="px-1 text-[11px] font-light italic text-ink-muted">
        {PARTICIPATION_CAPTION}
      </p>
    </div>
  )
}
