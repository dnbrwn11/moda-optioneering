import { useState } from 'react'
import Header from './components/Header'
import HeadlineBar from './components/HeadlineBar'
import ScenarioBar from './components/ScenarioBar'
import PhasingTab from './components/PhasingTab'
import SequenceTab from './components/sequence/SequenceTab'
import RoadmapTab from './components/RoadmapTab'
import AnalyticsTab from './components/AnalyticsTab'
import CapacityTab from './components/CapacityTab'
import ResourcesTab from './components/ResourcesTab'
import PrintReport from './components/PrintReport'

type Tab = 'phasing' | 'sequence' | 'roadmap' | 'analytics' | 'capacity' | 'resources'

const TABS: { id: Tab; label: string }[] = [
  { id: 'phasing', label: 'Phasing' },
  { id: 'sequence', label: 'Sequence' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'capacity', label: 'Capacity' },
  { id: 'resources', label: 'Resources' },
]

function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <div className="flex shrink-0 gap-1 border-b border-pcl-light bg-white px-6 pt-2">
      {TABS.map((t) => {
        const active = t.id === tab
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
              active
                ? 'border-pcl-green text-pcl-green'
                : 'border-transparent text-pcl-mid hover:text-pcl-dark'
            }`}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('phasing')

  return (
    <>
      {/* Interactive app — hidden while printing (see .screen-app in index.css). */}
      <div className="screen-app flex h-full flex-col bg-[#f4f4f3]">
        {/* Pinned chrome — header (with ESC chip) + KPI strip stay visible on
            scroll so the escalated total is always in view. Only <main> scrolls. */}
        <Header />
        <div className="shrink-0">
          <ScenarioBar />
          <HeadlineBar />
        </div>

        {/* Tabs switch only the content below. */}
        <TabBar tab={tab} onChange={setTab} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {tab === 'phasing' ? (
            <PhasingTab />
          ) : tab === 'sequence' ? (
            <SequenceTab />
          ) : tab === 'roadmap' ? (
            <RoadmapTab />
          ) : tab === 'analytics' ? (
            <AnalyticsTab />
          ) : tab === 'capacity' ? (
            <CapacityTab />
          ) : (
            <ResourcesTab />
          )}
        </main>
      </div>

      {/* Print-only report (Phasing snapshot). Screen-hidden; revealed by @media print. */}
      <PrintReport />
    </>
  )
}
