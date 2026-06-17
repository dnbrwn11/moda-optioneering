import Header from './components/Header'
import HeadlineBar from './components/HeadlineBar'
import EscalationStrip from './components/EscalationStrip'
import SummaryPanel from './components/SummaryPanel'
import Board from './components/Board'
import ContinuousSection from './components/ContinuousSection'

export default function App() {
  return (
    <div className="flex h-full flex-col bg-[#f4f4f3]">
      <Header />
      <HeadlineBar />
      <EscalationStrip />
      <SummaryPanel />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Board />
        <ContinuousSection />
      </main>
    </div>
  )
}
