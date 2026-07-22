import Shell from './Shell.jsx'
import './forge.css'

export default function Forge() {
  return (
    <div className="forge-stage">
      <Shell active />
      <Shell />
    </div>
  )
}
