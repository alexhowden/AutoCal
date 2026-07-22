import Shell from './Shell.jsx'
import { PageHead } from '../components/ui.jsx'
import './flare.css'

const items = [
  {
    id: 'wash light combo2',
    name: '1+3+5+7+8+10 // final mix',
    note: 'inner wash, drifting light, microcopy, chained pulses, stripe stagger, cyan glitch entry - loops every 10s',
  },
]

export default function Flare() {
  return (
    <>
      <PageHead title="Flare // one effect per row">
        <span>top: highlighted</span>
        <span>bottom: base</span>
      </PageHead>
      <div className="flare-stage">
        {items.map((it) => (
          <div key={it.id} className="flare-card">
            <span className="flare-name">{it.name}</span>
            <div className="flare-pair">
              <Shell scale={0.48} active flare={it.id} />
              <Shell scale={0.48} flare={it.id} />
            </div>
            <span className="flare-note">{it.note}</span>
          </div>
        ))}
      </div>
    </>
  )
}
