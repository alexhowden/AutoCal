import { useEffect, useState } from 'react'
import { FxProvider, useFx } from './fx.jsx'
import { ChatProvider } from './chat.jsx'
import Sidebar from './components/Sidebar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Calendar from './pages/Calendar.jsx'
import Chat from './pages/Chat.jsx'
import Activity from './pages/Activity.jsx'
import Notes from './pages/Notes.jsx'
import Settings from './pages/Settings.jsx'
import Lab from './pages/Lab.jsx'
import Forge from './pages/Forge.jsx'
import Flare from './pages/Flare.jsx'

// forge + flare are hidden from the sidebar but stay reachable via ?tab=
const pages = { dashboard: Dashboard, calendar: Calendar, chat: Chat, notes: Notes, activity: Activity, settings: Settings, lab: Lab, forge: Forge, flare: Flare }

const initialTab = () => {
  const t = new URLSearchParams(window.location.search).get('tab')
  return pages[t] ? t : 'dashboard'
}

function AppInner() {
  const [tab, setTab] = useState(initialTab)
  const { fx } = useFx()

  useEffect(() => {
    const onVis = () => document.body.classList.toggle('fx-paused', document.hidden)
    document.addEventListener('visibilitychange', onVis)
    onVis()
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return
    let unlisten
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('navigate', (e) => {
        const target = e.payload === 'import' ? 'chat' : e.payload
        if (pages[target]) setTab(target)
      }).then((fn) => {
        unlisten = fn
      })
    })
    return () => unlisten && unlisten()
  }, [])

  const Page = pages[tab]

  return (
    <>
      <div className={`bg-fx ${fx.sweep ? '' : 'no-sweep'}`} />
      {fx.embers && (
        <div className="embers">
          {Array.from({ length: 26 }, (_, i) => {
          const prand = (n) => {
            const x = Math.sin(n * 12.9898) * 43758.5453
            return x - Math.floor(x)
          }
          let wx = 0
          let wy = 0
          const waypoints = {}
          for (let leg = 1; leg <= 3; leg++) {
            const angle = prand(i * 3 + leg) * Math.PI * 2
            const dist = 150 + prand(i * 7 + leg) * 160
            wx += Math.cos(angle) * dist
            wy += Math.sin(angle) * dist
            waypoints[`--w${leg}x`] = `${wx.toFixed(0)}px`
            waypoints[`--w${leg}y`] = `${wy.toFixed(0)}px`
          }
          return (
            <i
              key={i}
              className="ember"
              style={{
                left: `${(i * 5.3 + 2) % 100}%`,
                top: `${(i * 11.7 + 7) % 100}%`,
                width: 3 + (i % 4),
                height: 3 + (i % 4),
                animationDuration: `${12 + prand(i) * 8}s`,
                animationDelay: `${(i * 1.3) % 12}s`,
                ...waypoints,
              }}
            />
          )
          })}
        </div>
      )}
      <div className="titlebar" data-tauri-drag-region />
      <div className="app">
        <Sidebar tab={tab} onSelect={setTab} />
        <main className="main">
          <Page />
        </main>
      </div>
    </>
  )
}

export default function App() {
  return (
    <FxProvider>
      <ChatProvider>
        <AppInner />
      </ChatProvider>
    </FxProvider>
  )
}
