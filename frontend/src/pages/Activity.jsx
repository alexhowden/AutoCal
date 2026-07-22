import { useEffect, useState } from 'react'
import { VentPanel, PageHead, Corners } from '../components/ui.jsx'
import { getActivity } from '../api.js'
import { localDate } from '../gcal.js'

const kinds = ['ALL', 'CREATE', 'EDIT', 'DELETE', 'SEARCH']

const kindTag = {
  CREATE: 'tag bright',
  EDIT: 'tag',
  DELETE: 'tag warn',
  IMPORT: 'tag cyan',
  SEARCH: 'tag dim',
  SYNC: 'tag dim',
}

export default function Activity() {
  const [log, setLog] = useState([])
  const [linkDown, setLinkDown] = useState(false)
  const [sel, setSel] = useState(() => new Set(['ALL']))

  useEffect(() => {
    getActivity()
      .then(setLog)
      .catch(() => setLinkDown(true))
  }, [])

  const toggle = (k) => {
    setSel((prev) => {
      if (k === 'ALL') return new Set(['ALL'])
      const next = new Set(prev)
      next.delete('ALL')
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next.size ? next : new Set(['ALL'])
    })
  }

  const today = localDate(new Date())
  const opsToday = log.filter((l) => l.ts.slice(0, 10) === today).length
  const lines = log.filter((l) => sel.has('ALL') || sel.has(l.kind))

  return (
    <>
      <PageHead title="Activity // operation log">
        <span>{opsToday} ops today</span>
        <span>
          retention <b>500 ops</b>
        </span>
        {linkDown && <span className="tag warn">link offline</span>}
      </PageHead>

      <div className="filter-row">
        {kinds.map((k) => (
          <button
            key={k}
            className={`filter-chip ${sel.has(k) ? 'active' : ''}`}
            onClick={() => toggle(k)}
          >
            {k}
          </button>
        ))}
      </div>

      <VentPanel title={`Log // ${today}`}>
        <div className="log-list">
          {lines.map((l, i) => (
            <div key={i} className="log-line hover-ck">
              <Corners />
              <span className="log-time">{l.ts.slice(11, 19)}</span>
              <span className={kindTag[l.kind] || 'tag'}>{l.kind}</span>
              <span className="log-text">{l.text}</span>
              <span className="log-src">{l.source}</span>
            </div>
          ))}
          {lines.length === 0 && (
            <div className="micro" style={{ padding: 12 }}>
              {linkDown ? 'link offline' : log.length === 0 ? 'no operations logged yet' : 'no operations match this filter'}
            </div>
          )}
        </div>
      </VentPanel>
    </>
  )
}
