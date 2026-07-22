import { useState } from 'react'
import { NodePanel, HButton, CyberSelect, Toggle } from './ui.jsx'
import { TODAY } from '../mock.js'

const cats = ['CLASS', 'ACADEMIC', 'SOCIAL', 'IMPORTANT']

// field set mirrors what the agent can patch through the APIs:
// events -> summary, start, end, location, colorId (category), description
// tasks  -> title, due, status, notes
export default function AgendaEdit({ item, onSave, onDelete, onClose }) {
  const isTask = item.type === 'task'
  const [form, setForm] = useState({
    name: item.name,
    date: item.date || TODAY,
    time: item.time || '',
    end: item.end || '',
    loc: item.loc || '',
    cat: item.cat,
    desc: item.desc || '',
    done: !!item.done,
  })
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }))
  const setV = (k) => (e) => set(k)(e.target.value)

  return (
    <div className="cal-detail-backdrop" onClick={onClose}>
      <div className="cal-detail wide" onClick={(e) => e.stopPropagation()}>
        <NodePanel
          title={isTask ? 'Task // edit' : 'Event // edit'}
          right={
            <button className="cal-x" onClick={onClose}>
              ✕
            </button>
          }
        >
          <div className="eform">
            <input
              className="finput etitle"
              value={form.name}
              onChange={setV('name')}
              placeholder="add title"
              spellCheck={false}
            />

            <div className="erow">
              <label className="efield">
                <span className="k">date</span>
                <input className="finput" value={form.date} onChange={setV('date')} spellCheck={false} />
              </label>
              <label className="efield">
                <span className="k">{isTask ? 'due' : 'start'}</span>
                <input className="finput" value={form.time} onChange={setV('time')} spellCheck={false} />
              </label>
              {!isTask && (
                <label className="efield">
                  <span className="k">end</span>
                  <input className="finput" value={form.end} onChange={setV('end')} spellCheck={false} />
                </label>
              )}
            </div>

            {!isTask && (
              <div className="erow">
                <label className="efield">
                  <span className="k">location</span>
                  <input
                    className="finput"
                    value={form.loc}
                    onChange={setV('loc')}
                    placeholder="add location"
                    spellCheck={false}
                  />
                </label>
                <div className="efield" style={{ maxWidth: 150 }}>
                  <span className="k">category</span>
                  <CyberSelect options={cats} value={form.cat} onChange={set('cat')} />
                </div>
              </div>
            )}

            {isTask && (
              <div className="efield">
                <span className="k">status</span>
                <div className="edone">
                  <Toggle on={form.done} onChange={set('done')} />
                  <span className="micro">{form.done ? 'complete' : 'needs action'}</span>
                </div>
              </div>
            )}

            <label className="efield">
              <span className="k">{isTask ? 'notes' : 'description'}</span>
              <textarea
                className="finput"
                rows={3}
                value={form.desc}
                onChange={setV('desc')}
                placeholder={isTask ? 'add notes' : 'add description'}
                spellCheck={false}
              />
            </label>

            <div className="ebtns">
              <HButton small onClick={() => onDelete(item.id)}>
                Delete
              </HButton>
              {!isTask && <HButton small>Open in GCal</HButton>}
              <HButton small primary onClick={() => onSave({ ...item, ...form })}>
                Save
              </HButton>
            </div>
          </div>
        </NodePanel>
      </div>
    </div>
  )
}
