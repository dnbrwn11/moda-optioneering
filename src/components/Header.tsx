// Clean header band with a labeled placeholder for the PCL logo (asset added
// later) top-left, plus the project title. PCL Green band, calm.

export default function Header() {
  return (
    <header className="flex items-center gap-6 border-b-4 border-pcl-yellow bg-pcl-green px-6 py-3">
      {/* Logo placeholder — sized for a horizontal PCL logo (~180x48). */}
      <div
        className="flex h-12 w-[180px] shrink-0 items-center justify-center rounded border border-dashed border-white/50 text-[11px] font-medium uppercase tracking-wider text-white/70"
        aria-label="PCL logo placeholder"
      >
        PCL logo
      </div>

      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold leading-tight text-white">
          Moda Center — Phase Optioneering
        </h1>
        <p className="truncate text-xs font-light text-white/80">
          CM/GC Interview Demo · Live cost &amp; phase modeling · Confidential
        </p>
      </div>
    </header>
  )
}
