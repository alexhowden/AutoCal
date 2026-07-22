import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Panel, PageHead, Toggle, HButton, CyberSelect } from '../components/ui.jsx'
import { useFx } from '../fx.jsx'
import { colorProtocol } from '../mock.js'

const timezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles']

const fxItems = [
  { key: 'embers', label: 'embers' },
  { key: 'sweep', label: 'sweep beam' },
  { key: 'tabPulse', label: 'tab pulse loop' },
]

function FxDropdown() {
  const { fx, setFx } = useFx()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)

  const on = fxItems.filter((i) => fx[i.key]).length

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(!open)
  }

  return (
    <div
      className="csel"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <button ref={btnRef} className="csel-btn" onClick={toggle}>
        {on} of {fxItems.length} active
        <span className="csel-arrow">{open ? '▴' : '▾'}</span>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            className="csel-list"
            style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {fxItems.map((i) => (
              <div key={i.key} className="fx-opt">
                <span>{i.label}</span>
                <Toggle on={fx[i.key]} onChange={(v) => setFx(i.key, v)} />
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

export default function Settings() {
  const [launchAtLogin, setLaunchAtLogin] = useState(true)
  const [conflictCheck, setConflictCheck] = useState(true)
  const [timezone, setTimezone] = useState('America/New_York')
  const [glow, setGlow] = useState(1)

  const setGlowMult = (v) => {
    setGlow(v)
    document.documentElement.style.setProperty('--glow-mult', v)
  }

  return (
    <>
      <PageHead title="Settings // system config">
        <span>
          profile <b>local</b>
        </span>
        <span>
          build <b>0.1.0</b>
        </span>
      </PageHead>

      <div className="settings-grid">
        <Panel title="Link status">
          <div className="setting-row">
            <div>
              <div className="setting-name">Claude Agent</div>
              <div className="setting-desc">claude-code login // subscription auth</div>
            </div>
            <span className="tag cyan">connected</span>
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-name">Google Calendar</div>
              <div className="setting-desc">you@gmail.com // scope: calendar</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span className="tag cyan">connected</span>
              <HButton small>Re-auth</HButton>
            </div>
          </div>
        </Panel>

        <Panel title="Preferences">
          <div className="setting-row">
            <div>
              <div className="setting-name">Launch at login</div>
              <div className="setting-desc">start AutoCal in the menu bar when you log in</div>
            </div>
            <Toggle on={launchAtLogin} onChange={setLaunchAtLogin} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-name">Conflict check</div>
              <div className="setting-desc">warn before creating items within 30 min of another</div>
            </div>
            <Toggle on={conflictCheck} onChange={setConflictCheck} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-name">Default timezone</div>
              <div className="setting-desc">applied when a request has no explicit zone</div>
            </div>
            <CyberSelect options={timezones} value={timezone} onChange={setTimezone} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-name">Ambient motion</div>
              <div className="setting-desc">toggle each background animation on its own</div>
            </div>
            <FxDropdown />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-name">Glow intensity</div>
              <div className="setting-desc">live - drag it and watch the whole UI</div>
            </div>
            <input
              type="range"
              className="cyber"
              min="0"
              max="2"
              step="0.1"
              value={glow}
              onChange={(e) => setGlowMult(e.target.value)}
            />
          </div>
        </Panel>

        <Panel title="Color protocol" right="maps categories → google calendar colors">
          {colorProtocol.map((row) => (
            <div key={row.cat} className="proto-row">
              <span className="swatch" style={{ background: row.hex }} />
              <span className="proto-cat">{row.cat}</span>
              <span className="proto-id">{row.id}</span>
              <HButton small>Edit</HButton>
            </div>
          ))}
        </Panel>
      </div>
    </>
  )
}
