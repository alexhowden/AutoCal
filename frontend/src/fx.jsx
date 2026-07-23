import { createContext, useContext, useEffect, useState } from 'react'

// module evaluates once at app boot - the sidebar loop animations start here,
// so anything that wants to phase-lock to them measures against this
export const APP_T0 = performance.now()

const defaults = { theme: 'cyberpunk', embers: true, sweep: true, tabPulse: true, gaugeMotion: true, bgMotion: true, glow: 1 }

const FxContext = createContext({ fx: defaults, setFx: () => {} })

export function FxProvider({ children }) {
  const [fx, setFxState] = useState(() => {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem('fx') || '{}') }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    document.documentElement.style.setProperty('--glow-mult', fx.glow)
  }, [fx.glow])

  // themes are CSS-only: every sheet scopes its overrides to this attribute.
  // it lives on <html> so portaled popups (document.body) are covered too
  useEffect(() => {
    document.documentElement.dataset.theme = fx.theme || 'cyberpunk'
  }, [fx.theme])

  const setFx = (key, val) => {
    setFxState((f) => {
      const next = { ...f, [key]: val }
      localStorage.setItem('fx', JSON.stringify(next))
      return next
    })
  }

  return <FxContext.Provider value={{ fx, setFx }}>{children}</FxContext.Provider>
}

export const useFx = () => useContext(FxContext)
