import { useLayoutEffect, useRef, useState } from 'react'
import './forge.css'
import './flare.css'

const BASE_W = 860
const BASE_H = 260

function wireGeometry(W, H, endInset = 0) {
  const notchStart = 0.13 * W + 10
  const lowStart = notchStart + 12
  const xL = 38 + (2 / 3) * (0.13 * W - 28)
  const xR = notchStart + 104
  const diagStart = lowStart - 18.9
  const mid = (lowStart + xR) / 2
  const wire2 = [
    `M${xL.toFixed(1)} 16`,
    `H${diagStart.toFixed(1)}`,
    `L${lowStart.toFixed(1)} 38`,
    `H${(mid - 3.45).toFixed(1)}`,
    `L${(mid + 3.45).toFixed(1)} 30`,
    `H${xR.toFixed(1)}`,
  ].join(' ')

  const wallH = H - 76
  const y0 = 7 + endInset
  const y1 = wallH - 7 - endInset
  const q1 = y0 + (y1 - y0) * 0.25
  const q3 = y0 + (y1 - y0) * 0.75
  const wire1 = [
    `M10 ${y0}`,
    `V${(q1 - 3.5).toFixed(1)}`,
    `L17 ${(q1 + 3.5).toFixed(1)}`,
    `V${(q3 - 3.5).toFixed(1)}`,
    `L10 ${(q3 + 3.5).toFixed(1)}`,
    `V${y1}`,
  ].join(' ')

  return { wire2, xL, xR, wire1, wallH, wire2W: xR + 8, n1y: y0 - 3.5, n2y: y1 + 3.5 }
}

function ShellBody({ active, flares, fit, dim, variant }) {
  const pips = flares.includes('combo2')
  const flareCls = flares.map((f) => `flare-${f}`).join(' ')
  const tab = variant === 'tab'
  const g = wireGeometry(dim.w, dim.h, tab ? 10 : 0)
  const pitch = tab ? 25 : 23
  const sw = tab ? 17 : 14
  const sl = tab ? 20 : 16
  const nTop = 6
  const nLeft = 6
  const nBt = 6
  const btStart = 170 + (pitch - sw)
  const topW = (nTop - 1) * pitch + sw + sl
  const leftH = (nLeft - 1) * pitch + sw + sl
  const btW = btStart + (nBt - 1) * pitch + sw + sl

  return (
    <div className={`forge-shell ${fit ? 'fit' : ''} ${tab ? 'v-tab' : ''} ${active ? 'active' : ''} ${flareCls}`}>
      <div className="forge-shell-in" />
      {active && <div className="forge-shell-fill" />}
      <svg className="forge-wire2" viewBox={`0 0 ${g.wire2W} 46`} width={g.wire2W} height="46">
        <path d={g.wire2} fill="none" stroke="currentColor" strokeWidth="3" />
        {pips && <path className="fpip" d={g.wire2} fill="none" strokeWidth="3" />}
        <circle cx={g.xL} cy="16" r="3" fill="currentColor" />
        <circle cx={g.xR} cy="30" r="3" fill="currentColor" />
      </svg>
      <svg className="forge-stripes" viewBox={`0 0 ${topW} ${sl}`} width={topW} height={sl}>
        {Array.from({ length: nTop }, (_, i) => (
          <path key={i} d={`M${i * pitch} 0 h${sw} l${sl} ${sl} h-${sw} Z`} fill="currentColor" />
        ))}
      </svg>
      <svg className="forge-stripes-v" viewBox={`0 0 ${sl} ${leftH}`} width={sl} height={leftH}>
        {Array.from({ length: nLeft }, (_, i) => (
          <path key={i} d={`M${sl} ${i * pitch} v${sw} l-${sl} ${sl} v-${sw} Z`} fill="currentColor" />
        ))}
      </svg>
      <svg className="forge-stripes-b" viewBox={`0 0 ${btW} ${sl}`} width={btW} height={sl}>
        <path d={`M0 0 h170 l${sl} ${sl} h-170 Z`} fill="currentColor" />
        {Array.from({ length: nBt }, (_, i) => (
          <path key={i} d={`M${btStart + i * pitch} 0 h${sw} l${sl} ${sl} h-${sw} Z`} fill="currentColor" />
        ))}
      </svg>
      {g.wallH > 40 && (
        <svg className="forge-wire" viewBox={`0 0 20 ${g.wallH}`} width="20" height={g.wallH}>
          <path d={g.wire1} fill="none" stroke="currentColor" strokeWidth="3" />
          {pips && <path className="fpipb" d={g.wire1} fill="none" strokeWidth="3" />}
          <circle cx="10" cy={g.n1y} r="3" fill="currentColor" />
          <circle cx="10" cy={g.n2y} r="3" fill="currentColor" />
        </svg>
      )}
      {tab && (
        <svg className="forge-wire3" viewBox={`0 0 ${g.wire2W} 46`} width={g.wire2W} height="46">
          <path d={g.wire2} fill="none" stroke="currentColor" strokeWidth="3" />
          {pips && <path className="fpipc" d={g.wire2} fill="none" strokeWidth="3" />}
          <circle cx={g.xL} cy="16" r="3" fill="currentColor" />
          <circle cx={g.xR} cy="30" r="3" fill="currentColor" />
        </svg>
      )}
    </div>
  )
}

export default function Shell({ active = false, flare = '', scale = 0, fit = false, variant = '' }) {
  const flares = flare.split(' ').filter(Boolean)
  const ref = useRef(null)
  const [dim, setDim] = useState({ w: BASE_W, h: BASE_H })

  useLayoutEffect(() => {
    if (!fit || !ref.current) return
    const el = ref.current
    const ro = new ResizeObserver(() => {
      setDim({ w: el.offsetWidth, h: el.offsetHeight })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fit])

  if (scale) {
    return (
      <div
        className="shell-scalebox"
        style={{ width: BASE_W * scale, height: BASE_H * scale, '--shs': scale }}
      >
        <div className="shell-scaler" style={{ transform: `scale(${scale})` }}>
          <ShellBody active={active} flares={flares} fit={false} dim={{ w: BASE_W, h: BASE_H }} variant={variant} />
        </div>
      </div>
    )
  }

  if (fit) {
    return (
      <div ref={ref} className="shell-fitbox">
        <ShellBody active={active} flares={flares} fit dim={dim} variant={variant} />
      </div>
    )
  }

  return <ShellBody active={active} flares={flares} fit={false} dim={{ w: BASE_W, h: BASE_H }} variant={variant} />
}
