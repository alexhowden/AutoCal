import { useState } from 'react'
import { NodePanel, HButton, CyberSelect, Toggle, JoinChip } from './ui.jsx'
import { localDate, getCats } from '../gcal.js'

// field set mirrors what the agent can patch through the APIs:
// events -> summary, start, end, location, colorId (category), description
// tasks  -> title, due, status, notes
export default function AgendaEdit({ item, onSave, onDelete, onClose }) {
  const isTask = item.type === 'task'
  const cats = getCats().map((c) => c.name)
  const [form, setForm] = useState({
    name: item.name,
    date: item.date || (item.type === 'task' ? '' : localDate(new Date())),
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
          title={isTask ? 'Task // edit' : item.isNew ? 'Event // new' : 'Event // edit'}
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
                <span className="k">{isTask ? 'due' : 'date'}</span>
                <input
                  className="finput"
                  value={form.date}
                  onChange={setV('date')}
                  placeholder={isTask ? 'no due date' : ''}
                  spellCheck={false}
                />
              </label>
              {!isTask && (
                <label className="efield">
                  <span className="k">start</span>
                  <input className="finput" value={form.time} onChange={setV('time')} spellCheck={false} />
                </label>
              )}
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
              {!isTask && <JoinChip url={item.meet} />}
              {!item.isNew && (
                <HButton small onClick={() => onDelete(item.id)}>
                  Delete
                </HButton>
              )}
              {!isTask && !item.isNew && (
                <HButton small onClick={() => item.link && window.open(item.link, '_blank')}>
                  Open in GCal
                </HButton>
              )}
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
