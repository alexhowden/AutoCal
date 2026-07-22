import { useState } from 'react'
import { VentPanel, PageHead, Corners } from '../components/ui.jsx'
import { activityLog } from '../mock.js'

const kinds = ['ALL', 'CREATE', 'EDIT', 'DELETE', 'IMPORT']

const kindTag = {
  CREATE: 'tag bright',
  EDIT: 'tag',
  DELETE: 'tag warn',
  IMPORT: 'tag cyan',
  SEARCH: 'tag dim',
  SYNC: 'tag dim',
}

export default function Activity() {
  const [sel, setSel] = useState(() => new Set(['ALL']))

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

  const lines = activityLog.filter((l) => sel.has('ALL') || sel.has(l.kind))

  return (
    <>
      <PageHead title="Activity // operation log">
        <span>{activityLog.length} ops today</span>
        <span>
          retention <b>30d</b>
        </span>
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

      <VentPanel title="Log // 2026-07-21">
        <div className="log-list">
          {lines.map((l, i) => (
            <div key={i} className="log-line hover-ck">
              <Corners />
              <span className="log-time">{l.time}</span>
              <span className={kindTag[l.kind]}>{l.kind}</span>
              <span className="log-text" dangerouslySetInnerHTML={{ __html: l.text }} />
            </div>
          ))}
          {lines.length === 0 && <div className="micro" style={{ padding: 12 }}>no operations match this filter</div>}
        </div>
      </VentPanel>
    </>
  )
}
