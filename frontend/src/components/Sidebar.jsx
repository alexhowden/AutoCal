import Shell from '../pages/Shell.jsx'
import { useFx } from '../fx.jsx'

const icons = {
  dashboard: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="1.5" width="5.2" height="5.2" />
      <rect x="9.3" y="1.5" width="5.2" height="5.2" />
      <rect x="1.5" y="9.3" width="5.2" height="5.2" />
      <rect x="9.3" y="9.3" width="5.2" height="5.2" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="1.5" y="3" width="13" height="11.5" />
      <path d="M1.5 6.5h13M5 1.5v3M11 1.5v3" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M1.5 2.5h13v9h-7l-3.5 3v-3h-2.5z" />
    </svg>
  ),
  notes: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M3 1.5h10v13H3z" />
      <path d="M5.5 4.5h5M5.5 7h5M5.5 9.5h3" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M1 8h3l2-5 4 10 2-5h3" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="2.4" />
      <path d="M8 1v2.4M8 12.6V15M1 8h2.4M12.6 8H15M3 3l1.7 1.7M11.3 11.3L13 13M13 3l-1.7 1.7M4.7 11.3L3 13" />
    </svg>
  ),
  lab: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M6 1.5h4M7 1.5v5L2.5 13a1.5 1.5 0 0 0 1.3 2h8.4a1.5 1.5 0 0 0 1.3-2L9 6.5v-5" />
      <path d="M4.5 10.5h7" />
    </svg>
  ),
  forge: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.5" y="4.5" width="11" height="7" />
      <path d="M1 2.5h3M12 2.5h3M1 13.5h3M12 13.5h3" />
    </svg>
  ),
  flare: (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M8 1.5 L9.8 6.2 L14.5 8 L9.8 9.8 L8 14.5 L6.2 9.8 L1.5 8 L6.2 6.2 Z" />
    </svg>
  ),
}

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'chat', label: 'Chat' },
  { id: 'notes', label: 'Notes' },
  { id: 'activity', label: 'Activity' },
  { id: 'settings', label: 'Settings' },
  { id: 'lab', label: 'UI Lab' },
]

export default function Sidebar({ tab, onSelect }) {
  const { fx } = useFx()
  return (
    <aside className="sidebar">
      <div>
        <div className="logo">AUTOCAL</div>
        <div className="logo-sub">agenda link // v0.1.0</div>
      </div>

      <nav className="nav">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            className={`nav-item ${tab === t.id ? 'active' : ''}`}
            onClick={() => onSelect(t.id)}
          >
            <span className="nav-shell">
              <Shell
                scale={0.24}
                variant="tab"
                flare={tab === t.id ? (fx.tabPulse ? 'wash light combo2' : 'wash light') : ''}
                active={tab === t.id}
              />
            </span>
            <span className="nav-label">
              {icons[t.id]}
              {t.label}
              <span className="nav-idx">{String(i + 1).padStart(2, '0')}</span>
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="status-row">
          <span className="dot" /> core: online
        </div>
        <div className="status-row" style={{ paddingLeft: 13 }}>
          link 127.0.0.1:8000
        </div>
        <svg className="circuit" width="120" height="26" viewBox="0 0 120 26" fill="none" stroke="var(--red-dim)" strokeWidth="1">
          <path d="M2 22h28l8-8h20l6 6h18" />
          <path d="M2 12h16l6-6h30" />
          <circle cx="34" cy="22" r="1.8" fill="var(--red-dim)" />
          <circle cx="58" cy="14" r="1.8" fill="var(--red-dim)" />
          <circle cx="82" cy="20" r="1.8" fill="var(--cyan-dim)" />
          <circle cx="54" cy="6" r="1.8" fill="var(--red-dim)" />
        </svg>
      </div>
    </aside>
  )
}
