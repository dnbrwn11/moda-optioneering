// Scenario bar — pinned with the KPI header. Active-scenario chip + dropdown
// (activate / rename / delete), Save / Save-as / Discard, and the Compare
// toggle with its target picker. All scenario state lives in the store (and
// the per-user Supabase rows); this component is pure UI over those actions.
import { useState } from 'react'
import { useStore } from '../store'
import { useActiveScenario, useCompareScenario, useIsModified } from '../lib/selectors'
import { BASELINE_ID, BASELINE_SCENARIO, MAX_USER_SCENARIOS } from '../lib/scenarios'
import type { Scenario } from '../lib/scenarios'
import { useSaveState } from '../lib/persistence'

// Same visual language as the PhasingTab scope-toggle switch.
function Switch({
  on,
  disabled,
  onToggle,
  label,
}: {
  on: boolean
  disabled?: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
        on ? 'bg-accent' : 'bg-line'
      } ${disabled ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${
          on ? 'left-3.5' : 'left-0.5'
        }`}
      />
    </button>
  )
}

const MENU_BTN =
  'rounded border border-line px-2 py-1 text-[11px] font-medium text-ink hover:bg-black/[0.04]'
const PRIMARY_BTN =
  'rounded bg-accent px-2 py-1 text-[11px] font-medium text-white hover:opacity-90'

// Remote save status: quiet when saved, explicit when saving/offline. The
// note (e.g. a cross-tab overwrite) surfaces as a hover title.
function SaveChip() {
  const status = useSaveState((s) => s.status)
  const note = useSaveState((s) => s.note)
  const label = status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving…' : 'Not saved — retrying'
  const tone =
    status === 'error'
      ? 'border-alert/40 bg-alert/10 text-alert'
      : 'border-line bg-black/[0.03] text-ink-muted'
  return (
    <span
      title={note ?? undefined}
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${tone}`}
    >
      {label}
    </span>
  )
}

export default function ScenarioBar() {
  const scenarios = useStore((s) => s.scenarios)
  const activeId = useStore((s) => s.activeScenarioId)
  const compareId = useStore((s) => s.compareScenarioId)
  const activateScenario = useStore((s) => s.activateScenario)
  const saveScenarioAs = useStore((s) => s.saveScenarioAs)
  const updateActiveScenario = useStore((s) => s.updateActiveScenario)
  const renameScenario = useStore((s) => s.renameScenario)
  const deleteScenario = useStore((s) => s.deleteScenario)
  const discardChanges = useStore((s) => s.discardChanges)
  const setCompareScenario = useStore((s) => s.setCompareScenario)

  const active = useActiveScenario()
  const compare = useCompareScenario()
  const modified = useIsModified()

  const [menuOpen, setMenuOpen] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)
  const [savingAs, setSavingAs] = useState(false)
  const [saveDraft, setSaveDraft] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [pendingActivateId, setPendingActivateId] = useState<string | null>(null)
  const [discardArmed, setDiscardArmed] = useState(false)

  const atCap = scenarios.length >= MAX_USER_SCENARIOS
  const all: Scenario[] = [BASELINE_SCENARIO, ...scenarios]
  // Compare candidates — anything but the active scenario.
  const compareCandidates = all.filter((s) => s.id !== activeId)

  const closeMenu = () => {
    setMenuOpen(false)
    setRenamingId(null)
    setConfirmDeleteId(null)
    setPendingActivateId(null)
  }

  const requestActivate = (id: string) => {
    if (id === activeId) {
      closeMenu()
      return
    }
    // Activation overwrites working state — confirm when edits are unsaved.
    if (modified) {
      setPendingActivateId(id)
      return
    }
    activateScenario(id)
    closeMenu()
  }

  const commitSaveAs = () => {
    if (!saveDraft.trim() || atCap) return
    saveScenarioAs(saveDraft)
    setSaveDraft('')
    setSavingAs(false)
  }

  const commitRename = () => {
    if (renamingId && renameDraft.trim()) renameScenario(renamingId, renameDraft)
    setRenamingId(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line bg-white px-6 py-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
        Scenario
      </span>

      {/* Active chip + dropdown. */}
      <div className="relative">
        <button
          type="button"
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
          aria-expanded={menuOpen}
          aria-label="Switch scenario"
          className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-bold text-accent hover:bg-accent/15"
        >
          <span className="max-w-[180px] truncate">{active.name}</span>
          {modified && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-yellow"
              title="Unsaved changes"
              aria-label="Unsaved changes"
            />
          )}
          <svg
            viewBox="0 0 12 12"
            aria-hidden
            className={`h-2.5 w-2.5 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 4.5 L6 8 L9.5 4.5" />
          </svg>
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" aria-hidden onClick={closeMenu} />
            <div className="absolute left-0 top-full z-50 mt-2 w-[300px] rounded-lg border border-line bg-white p-2 shadow-xl">
              {pendingActivateId ? (
                <div className="flex flex-col gap-2 p-1">
                  <p className="text-xs font-medium leading-snug text-ink">
                    Unsaved changes on “{active.name}” will be lost. Switch anyway?
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingActivateId(null)}
                      className={MENU_BTN}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        activateScenario(pendingActivateId)
                        closeMenu()
                      }}
                      className={PRIMARY_BTN}
                    >
                      Switch
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col">
                  {all.map((s) => {
                    const isActive = s.id === activeId
                    const isBaseline = s.id === BASELINE_ID
                    if (renamingId === s.id) {
                      return (
                        <div key={s.id} className="flex items-center gap-1.5 px-1 py-1">
                          <input
                            autoFocus
                            value={renameDraft}
                            maxLength={40}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRename()
                              if (e.key === 'Escape') setRenamingId(null)
                            }}
                            aria-label={`Rename ${s.name}`}
                            className="min-w-0 flex-1 rounded border border-accent px-2 py-1 text-xs text-ink outline-none"
                          />
                          <button type="button" onClick={commitRename} className={PRIMARY_BTN}>
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingId(null)}
                            className={MENU_BTN}
                          >
                            Cancel
                          </button>
                        </div>
                      )
                    }
                    if (confirmDeleteId === s.id) {
                      return (
                        <div key={s.id} className="flex items-center gap-1.5 px-1 py-1">
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-ink">
                            Delete “{s.name}”?
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              deleteScenario(s.id)
                              setConfirmDeleteId(null)
                            }}
                            className="rounded bg-alert px-2 py-1 text-[11px] font-medium text-white hover:opacity-90"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className={MENU_BTN}
                          >
                            Cancel
                          </button>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={s.id}
                        className="group flex items-center gap-1 rounded px-1 hover:bg-black/[0.03]"
                      >
                        <button
                          type="button"
                          onClick={() => requestActivate(s.id)}
                          className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
                        >
                          <span
                            className={`min-w-0 truncate text-xs ${
                              isActive ? 'font-bold text-brand-indigo' : 'font-medium text-ink'
                            }`}
                          >
                            {s.name}
                          </span>
                          {isActive && (
                            <span className="shrink-0 text-[10px] font-bold text-accent">✓</span>
                          )}
                        </button>
                        {isBaseline ? (
                          <span className="shrink-0 rounded bg-black/[0.04] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-muted">
                            permanent
                          </span>
                        ) : (
                          <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingId(s.id)
                                setRenameDraft(s.name)
                              }}
                              aria-label={`Rename ${s.name}`}
                              title="Rename"
                              className="rounded px-1 text-xs text-ink-muted hover:text-ink"
                            >
                              ✎
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(s.id)}
                              aria-label={`Delete ${s.name}`}
                              title="Delete"
                              className="rounded px-1 text-xs text-ink-muted hover:text-alert"
                            >
                              ✕
                            </button>
                          </span>
                        )}
                      </div>
                    )
                  })}
                  <p className="mt-1 border-t border-line/60 px-1 pt-1.5 text-[10px] font-light text-ink-muted">
                    {scenarios.length}/{MAX_USER_SCENARIOS} saved · Baseline is the shipped
                    source-reconciled state
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Save (overwrite active) — never offered on Baseline. */}
      {modified && active.id !== BASELINE_ID && (
        <button type="button" onClick={updateActiveScenario} className={PRIMARY_BTN}>
          Save
        </button>
      )}

      {/* Save-as — disabled with a hint at the scenario cap. */}
      {savingAs ? (
        <span className="flex items-center gap-1.5">
          <input
            autoFocus
            value={saveDraft}
            maxLength={40}
            placeholder="Scenario name"
            onChange={(e) => setSaveDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitSaveAs()
              if (e.key === 'Escape') setSavingAs(false)
            }}
            aria-label="New scenario name"
            className="w-44 rounded border border-accent px-2 py-1 text-xs text-ink outline-none"
          />
          <button
            type="button"
            onClick={commitSaveAs}
            disabled={!saveDraft.trim()}
            className={`${PRIMARY_BTN} disabled:cursor-default disabled:opacity-40`}
          >
            Save
          </button>
          <button type="button" onClick={() => setSavingAs(false)} className={MENU_BTN}>
            Cancel
          </button>
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSavingAs(true)}
            disabled={atCap}
            title={atCap ? `Scenario limit reached (${MAX_USER_SCENARIOS})` : 'Save current state as a new scenario'}
            className={`${MENU_BTN} disabled:cursor-default disabled:text-ink-muted disabled:hover:bg-transparent`}
          >
            Save as…
          </button>
          {atCap && (
            <span className="text-[10px] font-light italic text-ink-muted">
              scenario limit reached ({scenarios.length}/{MAX_USER_SCENARIOS})
            </span>
          )}
        </span>
      )}

      {/* Discard — two-step armed button, so one stray click can't drop edits. */}
      {modified && (
        <button
          type="button"
          onClick={() => {
            if (!discardArmed) {
              setDiscardArmed(true)
              return
            }
            discardChanges()
            setDiscardArmed(false)
          }}
          onBlur={() => setDiscardArmed(false)}
          className={`rounded px-2 py-1 text-[11px] font-medium ${
            discardArmed
              ? 'bg-alert text-white'
              : 'text-ink-muted underline-offset-2 hover:text-ink hover:underline'
          }`}
        >
          {discardArmed ? 'Discard edits?' : 'Discard'}
        </button>
      )}

      {/* Save-state chip — surfaces the remote persistence status. */}
      <SaveChip />

      {/* Compare toggle + target picker, right-aligned. */}
      <span className="ml-auto flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">
          Compare
        </span>
        <Switch
          on={compareId !== null}
          disabled={compareCandidates.length === 0}
          label="Compare scenarios"
          onToggle={() => {
            if (compareId !== null) setCompareScenario(null)
            else if (compareCandidates.length > 0) setCompareScenario(compareCandidates[0].id)
          }}
        />
        {compareCandidates.length === 0 && (
          <span className="text-[10px] font-light italic text-ink-muted">
            save a scenario to compare
          </span>
        )}
        {compare && (
          <span className="relative">
            <button
              type="button"
              onClick={() => setCompareOpen((o) => !o)}
              aria-expanded={compareOpen}
              aria-label="Choose comparison scenario"
              className="flex items-center gap-1.5 rounded-full border border-brand-indigo/40 bg-brand-indigo/10 px-3 py-1 text-xs font-bold text-brand-indigo hover:bg-brand-indigo/15"
            >
              <span className="max-w-[160px] truncate">vs {compare.name}</span>
              <svg
                viewBox="0 0 12 12"
                aria-hidden
                className={`h-2.5 w-2.5 transition-transform duration-200 ${compareOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2.5 4.5 L6 8 L9.5 4.5" />
              </svg>
            </button>
            {compareOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden onClick={() => setCompareOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-2 w-[220px] rounded-lg border border-line bg-white p-2 shadow-xl">
                  {compareCandidates.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setCompareScenario(s.id)
                        setCompareOpen(false)
                      }}
                      className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs hover:bg-black/[0.03] ${
                        s.id === compare.id
                          ? 'font-bold text-brand-indigo'
                          : 'font-medium text-ink'
                      }`}
                    >
                      <span className="min-w-0 truncate">{s.name}</span>
                      {s.id === compare.id && <span className="shrink-0 text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </span>
        )}
      </span>
    </div>
  )
}
