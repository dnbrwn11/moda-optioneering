// One-time offer to import pre-migration localStorage scenarios into the
// user's account. Shown between hydration and app render; either choice
// clears the legacy keys and records the decision server-side, so the offer
// never reappears.
export default function ImportOffer({
  localCount,
  skipCount,
  onImport,
  onDiscard,
}: {
  localCount: number
  skipCount: number
  onImport: () => void
  onDiscard: () => void
}) {
  const importable = localCount - skipCount
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-[#f4f4f3] px-6">
      <div className="w-full max-w-md rounded border border-line bg-white p-6 shadow-sm">
        <div className="text-base font-bold text-ink">
          {localCount > 0 ? 'Scenarios found in this browser' : 'Edits found in this browser'}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {localCount > 0
            ? `This browser has ${localCount === 1 ? 'a scenario' : `${localCount} scenarios`} saved by the pre-login version of the planner. Import ${localCount === 1 ? 'it' : 'them'} into your account?`
            : 'This browser has working-state edits saved by the pre-login version of the planner. Import them into your account?'}
          {skipCount > 0
            ? ` Only ${importable} can be imported — the 6-scenario limit would be exceeded; ${skipCount} will be skipped.`
            : ''}{' '}
          {localCount > 0 ? 'Local working-state edits are restored too. ' : ''}This offer appears
          only once; either choice removes the old browser copy.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onImport}
            className="rounded bg-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90"
          >
            {localCount === 0
              ? 'Import edits'
              : `Import ${importable === 1 ? 'scenario' : `${importable} scenarios`}`}
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded border border-line px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-ink hover:bg-black/[0.04]"
          >
            Start fresh
          </button>
        </div>
      </div>
    </div>
  )
}
