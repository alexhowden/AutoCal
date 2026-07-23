import { useLayoutEffect, useRef, useState } from 'react'
import './forge.css'
import './flare.css'

const BASE_W = 860
const BASE_H = 260

// ---- pip travel keyframes -------------------------------------------------
// the pips used to be stroke-dashoffset animations on svg paths - SVG-internal
// animation can't be GPU-offloaded, so every frame forced a style+compositing
// pass (the single biggest CPU cost in the app). instead the pip is now an
// HTML element tracing the same wire with composited transform keyframes,
// precomputed here for the only two geometries shells ever use.

function pipKeyframes(name, verts, startPct, endPct) {
  const lens = []
  let total = 0
  for (let i = 1; i < verts.length; i++) {
    const l = Math.hypot(verts[i][0] - verts[i - 1][0], verts[i][1] - verts[i - 1][1])
    lens.push(l)
    total += l
  }
  const frames = [`0% { opacity: 0; transform: translate(${verts[0][0]}px, ${verts[0][1]}px); }`]
  frames.push(`${(startPct - 0.01).toFixed(2)}% { opacity: 0; transform: translate(${verts[0][0]}px, ${verts[0][1]}px); }`)
  let dist = 0
  for (let i = 0; i < verts.length; i++) {
    const pct = startPct + (dist / total) * (endPct - startPct)
    const [x, y] = verts[i]
    if (i > 0) {
      // snap to the outgoing segment's angle just after the corner
      const a = (Math.atan2(y - verts[i - 1][1], x - verts[i - 1][0]) * 180) / Math.PI
      frames.push(`${pct.toFixed(2)}% { opacity: 1; transform: translate(${x}px, ${y}px) rotate(${a.toFixed(1)}deg); }`)
    }
    if (i < verts.length - 1) {
      const a = (Math.atan2(verts[i + 1][1] - y, verts[i + 1][0] - x) * 180) / Math.PI
      frames.push(`${(pct + 0.01).toFixed(2)}% { opacity: 1; transform: translate(${x}px, ${y}px) rotate(${a.toFixed(1)}deg); }`)
      dist += lens[i]
    }
  }
  const [ex, ey] = verts[verts.length - 1]
  frames.push(`${(endPct + 0.6).toFixed(2)}% { opacity: 0; transform: translate(${ex}px, ${ey}px); }`)
  frames.push(`100% { opacity: 0; transform: translate(${ex}px, ${ey}px); }`)
  return `@keyframes ${name} { ${frames.join(' ')} }`
}

function wire2Verts(g) {
  const notchStart = 0.13 * BASE_W + 10
  const lowStart = notchStart + 12
  const diagStart = lowStart - 18.9
  const mid = (lowStart + g.xR) / 2
  return [
    [g.xL, 16],
    [diagStart, 16],
    [lowStart, 38],
    [mid - 3.45, 38],
    [mid + 3.45, 30],
    [g.xR, 30],
  ]
}

function wire1Verts(g) {
  const y0 = g.n1y + 3.5
  const y1 = g.n2y - 3.5
  const q1 = y0 + (y1 - y0) * 0.25
  const q3 = y0 + (y1 - y0) * 0.75
  return [
    [10, y0],
    [10, q1 - 3.5],
    [17, q1 + 3.5],
    [17, q3 - 3.5],
    [10, q3 + 3.5],
    [10, y1],
  ]
}

{
  const gTab = wireGeometry(BASE_W, BASE_H, 10)
  const gFull = wireGeometry(BASE_W, BASE_H, 0)
  const style = document.createElement('style')
  style.textContent = [
    pipKeyframes('pip-w2a', wire2Verts(gTab), 14.3, 28.6),
    pipKeyframes('pip-w1-tab', wire1Verts(gTab), 28.6, 44.3),
    pipKeyframes('pip-w1-full', wire1Verts(gFull), 28.6, 44.3),
    pipKeyframes('pip-w2c', wire2Verts(gTab), 44.3, 58.6),
  ].join('\n')
  document.head.appendChild(style)
}

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
      <span className="forge-wire2">
        <svg viewBox={`0 0 ${g.wire2W} 46`} width={g.wire2W} height="46">
          <path d={g.wire2} fill="none" stroke="currentColor" strokeWidth="3" />
          <circle cx={g.xL} cy="16" r="3" fill="currentColor" />
          <circle cx={g.xR} cy="30" r="3" fill="currentColor" />
        </svg>
        {pips && <i className="wire-pip" style={{ animationName: 'pip-w2a' }} />}
      </span>
      {/* one svg PER stripe: the boot-in fade animates HTML-level elements, which
          the GPU composites - animating paths inside one svg repaints every frame */}
      <div className="forge-stripes" style={{ width: topW, height: sl }}>
        {Array.from({ length: nTop }, (_, i) => (
          <svg key={i} style={{ left: i * pitch }} viewBox={`0 0 ${sw + sl} ${sl}`} width={sw + sl} height={sl}>
            <path d={`M0 0 h${sw} l${sl} ${sl} h-${sw} Z`} fill="currentColor" />
          </svg>
        ))}
      </div>
      <div className="forge-stripes-v" style={{ width: sl, height: leftH }}>
        {Array.from({ length: nLeft }, (_, i) => (
          <svg key={i} style={{ top: i * pitch }} viewBox={`0 0 ${sl} ${sw + sl}`} width={sl} height={sw + sl}>
            <path d={`M${sl} 0 v${sw} l-${sl} ${sl} v-${sw} Z`} fill="currentColor" />
          </svg>
        ))}
      </div>
      <div className="forge-stripes-b" style={{ width: btW, height: sl }}>
        <svg viewBox={`0 0 ${170 + sl} ${sl}`} width={170 + sl} height={sl}>
          <path d={`M0 0 h170 l${sl} ${sl} h-170 Z`} fill="currentColor" />
        </svg>
        {Array.from({ length: nBt }, (_, i) => (
          <svg key={i} style={{ left: btStart + i * pitch }} viewBox={`0 0 ${sw + sl} ${sl}`} width={sw + sl} height={sl}>
            <path d={`M0 0 h${sw} l${sl} ${sl} h-${sw} Z`} fill="currentColor" />
          </svg>
        ))}
      </div>
      {g.wallH > 40 && (
        <span className="forge-wire">
          <svg viewBox={`0 0 20 ${g.wallH}`} width="20" height={g.wallH}>
            <path d={g.wire1} fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx="10" cy={g.n1y} r="3" fill="currentColor" />
            <circle cx="10" cy={g.n2y} r="3" fill="currentColor" />
          </svg>
          {pips && <i className="wire-pip" style={{ animationName: tab ? 'pip-w1-tab' : 'pip-w1-full' }} />}
        </span>
      )}
      {tab && (
        <span className="forge-wire3">
          <svg viewBox={`0 0 ${g.wire2W} 46`} width={g.wire2W} height="46">
            <path d={g.wire2} fill="none" stroke="currentColor" strokeWidth="3" />
            <circle cx={g.xL} cy="16" r="3" fill="currentColor" />
            <circle cx={g.xR} cy="30" r="3" fill="currentColor" />
          </svg>
          {pips && <i className="wire-pip" style={{ animationName: 'pip-w2c' }} />}
        </span>
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
