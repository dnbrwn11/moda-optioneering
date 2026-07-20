// On/off switch (view-only chrome) — shared by the Phasing and Analytics tabs.
export default function Switch({
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
      className="flex items-center gap-2 text-xs font-medium text-ink"
    >
      <span className="uppercase tracking-wider text-ink-muted">{label}</span>
      <span
        className={`relative h-4 w-7 rounded-full transition-colors ${
          on ? 'bg-accent' : 'bg-line'
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
