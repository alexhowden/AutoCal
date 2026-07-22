import { createContext, useContext, useState } from 'react'

const defaults = { embers: true, sweep: true, tabPulse: true }

const FxContext = createContext({ fx: defaults, setFx: () => {} })

export function FxProvider({ children }) {
  const [fx, setFxState] = useState(() => {
    try {
      return { ...defaults, ...JSON.parse(localStorage.getItem('fx') || '{}') }
    } catch {
      return defaults
    }
  })

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
