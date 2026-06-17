import ScenarioButtons from './ScenarioButtons'

// Clean header band with a labeled placeholder for the PCL logo (asset added
// later) top-left, the project title, and the scenario presets top-right.
// PCL Green band, calm.

export default function Header() {
  return (
    <header className="flex items-center gap-6 border-b-4 border-pcl-yellow bg-pcl-green px-6 py-3">
      {/* PCL logo — constrained by height, width auto-scales (aspect kept). */}
      <img
        src="/logos/PCL_Construction.svg.png"
        alt="PCL"
        className="h-9 w-auto shrink-0 py-0.5"
      />

      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold leading-tight text-white">
          Moda Center — Phase Optioneering
        </h1>
        <p className="truncate text-xs font-light text-white/80">
          CM/GC Interview Demo · Live cost &amp; phase modeling · Confidential
        </p>
      </div>

      <div className="ml-auto">
        <ScenarioButtons />
      </div>
    </header>
  )
}
