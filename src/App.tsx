import Header from './components/Header'
import HeadlineBar from './components/HeadlineBar'
import EscalationStrip from './components/EscalationStrip'
import Board from './components/Board'

export default function App() {
  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f4f4f3]">
      <Header />
      <HeadlineBar />
      <EscalationStrip />
      <Board />
    </div>
  )
}
