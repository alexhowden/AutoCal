import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function Corners() {
  return (
    <>
      <i className="ck ck-tl" />
      <i className="ck ck-tr" />
      <i className="ck ck-bl" />
      <i className="ck ck-br" />
    </>
  )
}

export function Panel({ title, right, cyan = false, className = '', bodyClass = '', children }) {
  return (
    <div className={`panel-frame ${cyan ? 'cyan' : ''} ${className}`}>
      <div className={`panel-body ${bodyClass}`}>
        {(title || right) && (
          <div className="panel-head">
            <div className="panel-title">{title}</div>
            {right && <span className="micro">{right}</span>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function NodePanel({ title, right, center = false, className = '', children }) {
  return (
    <div className={`np ${className}`}>
      <div className="np-in">
        <div className="np-head">
          <span className="np-title">{title}</span>
          {right && <span className="micro">{right}</span>}
        </div>
        <div className="np-line">
          <i className="npd" />
          <i className="npl" />
          <i className="npd" />
        </div>
        <div className={`np-body ${center ? 'center' : ''}`}>{children}</div>
      </div>
    </div>
  )
}

export function WirePanel({ title, right, center = false, className = '', children }) {
  return (
    <div className={`wp ${className}`}>
      <div className="wp-in">
        <div className="wp-wire">
          <i className="wpd" />
          <i className="wpv" />
          <svg className="wpj" width="14" height="12" viewBox="0 0 14 12">
            <path d="M3 0 V2 L11 10 V12" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
          <i className="wpv v2" />
          <i className="wpd d2" />
        </div>
        <div className="wp-head">
          <span className="wp-title">{title}</span>
          {right && <span className="micro">{right}</span>}
        </div>
        <div className={`wp-body ${center ? 'center' : ''}`}>{children}</div>
      </div>
    </div>
  )
}

export function VentPanel({ title, right, className = '', bodyClass = '', children }) {
  return (
    <div className={`vp ${className}`}>
      <div className="vp-in">
        <i className="vp-vents" />
        {(title || right) && (
          <div className="wp-head vent-head">
            <span className="wp-title">{title}</span>
            {right && <span className="micro">{right}</span>}
          </div>
        )}
        <div className={`vp-body ${bodyClass}`}>{children}</div>
      </div>
    </div>
  )
}

export function HButton({ children, small = false, primary = false, disabled = false, onClick }) {
  return (
    <button
      className={`hbtn ${small ? 'small' : ''} ${primary ? 'primary' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <i className="hbk hbk1" />
      <i className="hbk hbk2" />
      <i className="hbk hbk3" />
      <i className="hbk hbk4" />
      {children}
    </button>
  )
}

export function CyberSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)

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
        {value}
        <span className="csel-arrow">{open ? '▴' : '▾'}</span>
      </button>
      {open &&
        pos &&
        createPortal(
          <div className="csel-list" style={{ top: pos.top, left: pos.left, minWidth: pos.width }}>
            {options.map((o) => (
              <div
                key={o}
                className={`csel-opt ${o === value ? 'sel' : ''}`}
                onMouseDown={() => {
                  onChange(o)
                  setOpen(false)
                }}
              >
                {o}
              </div>
            ))}
          </div>,
          document.body
        )}
    </div>
  )
}

export function SegBar({ frac = 0, count = 22, pulse = false, hot = 0 }) {
  const on = Math.round(frac * count)
  return (
    <div className="segbar">
      {Array.from({ length: count }, (_, i) => {
        let cls = 'seg'
        if (pulse) cls += ' pulse'
        else if (i < on) cls += i >= on - hot ? ' hot' : ' on'
        return (
          <i
            key={i}
            className={cls}
            style={pulse ? { animationDelay: `${i * 55}ms` } : undefined}
          />
        )
      })}
    </div>
  )
}

export function RingGauge({ value, max, label, cyan = false }) {
  const r = 34
  const c = 2 * Math.PI * r
  const frac = Math.min(max ? value / max : 0, 1)
  return (
    <div className="ring">
      <div className="ring-wrap">
        <svg viewBox="0 0 84 84" width="84" height="84">
          <circle className="ring-track" cx="42" cy="42" r={r} />
          <circle
            className={`ring-arc ${cyan ? 'cyan' : ''}`}
            cx="42"
            cy="42"
            r={r}
            stroke={cyan ? 'var(--cyan-data)' : 'var(--red)'}
            strokeDasharray={`${c * frac} ${c}`}
            transform="rotate(-90 42 42)"
          />
        </svg>
        <div className="ring-center">
          <span className="ring-val">
            {value}
            <span className="ring-max">/{max}</span>
          </span>
        </div>
      </div>
      {label && <span className="ring-label">{label}</span>}
    </div>
  )
}

export function PageHead({ title, children }) {
  const parts = title.split('//')
  return (
    <div className="page-head">
      <div className="page-title">
        {parts[0].trim()}
        {parts[1] && <span className="slash">//</span>}
        {parts[1] && <span className="page-title-sub">{parts[1].trim()}</span>}
      </div>
      <span className="micro">{children}</span>
    </div>
  )
}

export function Toggle({ on, onChange }) {
  return (
    <div
      className={`toggle ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={() => onChange(!on)}
      onKeyDown={(e) => e.key === 'Enter' && onChange(!on)}
    />
  )
}
