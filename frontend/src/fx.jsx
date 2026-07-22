import { createContext, useContext, useEffect, useState } from 'react'

// module evaluates once at app boot - the sidebar loop animations start here,
// so anything that wants to phase-lock to them measures against this
export const APP_T0 = performance.now()

const defaults = { embers: true, sweep: true, tabPulse: true, glow: 1 }

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
