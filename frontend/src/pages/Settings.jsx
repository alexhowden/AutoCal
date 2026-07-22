import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Panel, PageHead, Toggle, HButton, CyberSelect } from '../components/ui.jsx'
import { getSettings, patchSettings, getStatus, reauthGoogle, unlinkAccount } from '../api.js'
import { useFx } from '../fx.jsx'
import { PALETTE, getCats, setCats } from '../gcal.js'

const timezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles']

const inTauri = '__TAURI_INTERNALS__' in window

const fxItems = [
  { key: 'embers', label: 'embers' },
  { key: 'sweep', label: 'sweep beam' },
  { key: 'tabPulse', label: 'tab pulse loop' },
]

function SwatchPicker({ colorId, onPick }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
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
      <button
        ref={btnRef}
        className="swatch swatch-btn"
        style={{ background: PALETTE[colorId]?.hex }}
        title={PALETTE[colorId]?.name}
        onClick={toggle}
      />
      {open &&
        pos &&
        createPortal(
          <div className="color-pop" style={{ top: pos.top, left: pos.left }} onMouseDown={(e) => e.preventDefault()}>
            {Object.entries(PALETTE).map(([cid, c]) => (
              <button
                key={cid}
                className={`swatch swatch-btn ${cid === colorId ? 'sel' : ''}`}
                style={{ background: c.hex }}
                title={`${c.name} // colorId ${cid}`}
                onClick={() => {
                  onPick(cid)
                  setOpen(false)
                }}
              />
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

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
  const { fx, setFx } = useFx()
  const [settings, setSettings] = useState(null)
  const [status, setStatus] = useState(null)
  const [linkDown, setLinkDown] = useState(false)
  const [reauthing, setReauthing] = useState(false)

  const refreshStatus = () =>
    getStatus()
      .then(setStatus)
      .catch(() => setLinkDown(true))

  useEffect(() => {
    getSettings()
      .then(async (s) => {
        // in the app, the OS launch-agent state is the source of truth
        if (inTauri) {
          try {
            const { isEnabled } = await import('@tauri-apps/plugin-autostart')
            s = { ...s, launchAtLogin: await isEnabled() }
          } catch {
            // plugin unavailable (old build) - fall back to the stored value
          }
        }
        setSettings(s)
      })
      .catch(() => setLinkDown(true))
    refreshStatus()
  }, [])

  const setLaunchAtLogin = async (v) => {
    update({ launchAtLogin: v })
    if (!inTauri) return
    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart')
      if (v) await enable()
      else await disable()
    } catch {
      // ignore - browser dev or plugin missing
    }
  }

  // optimistic write-through; the backend agent reads these on new sessions
  const update = (patch) => {
    setSettings((s) => ({ ...s, ...patch }))
    patchSettings(patch).catch(() => setLinkDown(true))
  }

  const reauth = async () => {
    setReauthing(true)
    try {
      await reauthGoogle()
    } catch {
      // flow cancelled or timed out - status refresh below tells the truth
    }
    setReauthing(false)
    refreshStatus()
  }

  const unlink = async (email) => {
    try {
      await unlinkAccount(email)
    } catch {
      setLinkDown(true)
    }
    refreshStatus()
  }

  const google = status?.google
  const agent = status?.agent

  const cats = settings?.categories ?? getCats()
  const setRows = (rows) => {
    setCats(rows)
    setSettings((s) => ({ ...s, categories: rows }))
    patchSettings({ categories: rows }).catch(() => setLinkDown(true))
  }
  const editRow = (i, patch) => setRows(cats.map((c, j) => (j === i ? { ...c, ...patch } : c)))
  const addRow = () => setRows([...cats, { name: 'NEW', colorId: '1' }])
  const delRow = (i) => cats.length > 1 && setRows(cats.filter((_, j) => j !== i))

  return (
    <>
      <PageHead title="Settings // system config">
        <span>
          profile <b>local</b>
        </span>
        <span>
          build <b>0.1.0</b>
        </span>
        {linkDown && <span className="tag warn">link offline</span>}
      </PageHead>

      <div className="settings-grid">
        <Panel title="Link status">
          <div className="setting-row">
            <div>
              <div className="setting-name">Claude Agent</div>
              <div className="setting-desc">
                claude agent sdk // {agent ? `${agent.sessions} active session${agent.sessions === 1 ? '' : 's'}` : '...'}
              </div>
            </div>
            <span className={`tag ${agent?.ready ? 'cyan' : 'warn'}`}>
              {agent ? (agent.ready ? 'ready' : 'offline') : '...'}
            </span>
          </div>
          {(google ?? [{ email: '', connected: false, reason: '...' }]).map((g, i) => (
            <div key={i} className="setting-row">
              <div>
                <div className="setting-name">
                  Google Calendar{google?.length > 1 ? ` // ${i === 0 ? 'primary' : 'linked'}` : ''}
                </div>
                <div className="setting-desc">
                  {g.connected
                    ? `${g.email} // ${g.scopes.join(' + ')}`
                    : `${g.email || 'account'} // ${g.reason}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className={`tag ${g.connected ? 'cyan' : 'warn'}`}>
                  {g.connected ? 'connected' : 'not linked'}
                </span>
                {g.email && (
                  <HButton small onClick={() => unlink(g.email)}>
                    Unlink
                  </HButton>
                )}
              </div>
            </div>
          ))}
          {google?.length === 0 && (
            <div className="setting-row">
              <div>
                <div className="setting-name">Google Calendar</div>
                <div className="setting-desc">no accounts linked</div>
              </div>
              <span className="tag warn">not linked</span>
            </div>
          )}
          <div className="setting-row">
            <div>
              <div className="setting-name">Link account</div>
              <div className="setting-desc">
                add another google account or re-auth an existing one - tasks stay on primary
              </div>
            </div>
            <HButton small onClick={reauth} disabled={reauthing}>
              {reauthing ? 'Check browser...' : 'Link account'}
            </HButton>
          </div>
        </Panel>

        <Panel title="Preferences">
          <div className="setting-row">
            <div>
              <div className="setting-name">Launch at login</div>
              <div className="setting-desc">start AutoCal in the menu bar when you log in</div>
            </div>
            <Toggle on={settings?.launchAtLogin ?? true} onChange={setLaunchAtLogin} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-name">Conflict check</div>
              <div className="setting-desc">warn before creating items within 30 min of another</div>
            </div>
            <Toggle on={settings?.conflictCheck ?? true} onChange={(v) => update({ conflictCheck: v })} />
          </div>
          <div className="setting-row">
            <div>
              <div className="setting-name">Default timezone</div>
              <div className="setting-desc">applied when a request has no explicit zone</div>
            </div>
            <CyberSelect
              options={timezones}
              value={settings?.timezone ?? 'America/New_York'}
              onChange={(v) => update({ timezone: v })}
            />
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
              value={fx.glow}
              onChange={(e) => setFx('glow', Number(e.target.value))}
            />
          </div>
        </Panel>

        <Panel title="Color protocol" right="maps your categories → google calendar colors">
          {cats.map((row, i) => (
            <div key={i} className="proto-row">
              <SwatchPicker colorId={row.colorId} onPick={(cid) => editRow(i, { colorId: cid })} />
              <input
                className="finput proto-name"
                value={row.name}
                spellCheck={false}
                onChange={(e) => editRow(i, { name: e.target.value.toUpperCase() })}
              />
              <span className="proto-id">
                {PALETTE[row.colorId]?.name.toLowerCase()} // colorId {row.colorId}
                {i === cats.length - 1 ? ' // fallback' : ''}
              </span>
              <button className="note-x proto-x" onClick={() => delRow(i)} disabled={cats.length <= 1}>
                ✕
              </button>
            </div>
          ))}
          <div className="proto-add">
            <HButton small onClick={addRow}>
              Add category
            </HButton>
          </div>
        </Panel>
      </div>
    </>
  )
}
