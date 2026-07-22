import { useState } from 'react'
import { NodePanel, WirePanel, RingGauge, SegBar, PageHead, Corners, HButton } from '../components/ui.jsx'
import AgendaEdit from '../components/AgendaEdit.jsx'
import { agenda, untimedTasks, nowMark, catStyle, TODAY } from '../mock.js'

export default function Dashboard() {
  const [items, setItems] = useState(agenda)
  const [tasks, setTasks] = useState(untimedTasks)
  const [editing, setEditing] = useState(null)
  const [taskEdit, setTaskEdit] = useState(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const [armed, setArmed] = useState(null)

  const events = items.filter((a) => a.type === 'event')
  const timedTasks = items.filter((a) => a.type === 'task')
  const allTasks = [...timedTasks, ...tasks]
  const tasksDone = allTasks.filter((t) => t.done).length
  const untimedDone = tasks.filter((t) => t.done).length

  const saveItem = (updated) => {
    setItems((ls) => ls.map((it) => (it.id === updated.id ? updated : it)))
    setEditing(null)
  }

  const deleteItem = (id) => {
    setItems((ls) => ls.filter((it) => it.id !== id))
    setEditing(null)
  }

  const addTask = () => {
    const id = Math.max(0, ...items.map((i) => i.id), ...tasks.map((t) => t.id)) + 1
    setTasks((ts) => [...ts, { id, name: '', done: false }])
    setTaskEdit({ id, value: '' })
  }

  const commitTask = () => {
    if (!taskEdit) return
    const name = taskEdit.value.trim()
    setTasks((ts) => (name ? ts.map((t) => (t.id === taskEdit.id ? { ...t, name } : t)) : ts.filter((t) => t.id !== taskEdit.id)))
    setTaskEdit(null)
  }

  const cancelTask = () => {
    if (!taskEdit) return
    setTasks((ts) => ts.filter((t) => t.id !== taskEdit.id || t.name))
    setTaskEdit(null)
  }

  const dropTask = (i) => {
    if (dragIdx !== null && dragIdx !== i) {
      setTasks((ts) => {
        const next = [...ts]
        const [moved] = next.splice(dragIdx, 1)
        next.splice(i, 0, moved)
        return next
      })
    }
    setDragIdx(null)
    setOverIdx(null)
    setArmed(null)
  }

  return (
    <>
      <PageHead title="Dashboard">
        <b>{TODAY}</b>
        <span>
          sync <span className="c">18:42:07</span>
        </span>
        <span>link 127.0.0.1:8000</span>
      </PageHead>

      <div className="stat-row">
        <WirePanel title="Events" center>
          <RingGauge value={events.length} max={8} />
        </WirePanel>
        <WirePanel title="Tasks" center>
          <RingGauge value={tasksDone} max={allTasks.length} cyan />
        </WirePanel>
        <WirePanel title="Schedule load" right={<b className="load-pct">62%</b>}>
          <div className="load-panel">
            <SegBar frac={0.62} hot={2} />
            <span className="micro">
              <span>
                peak window <b>14:00 - 16:00</b>
              </span>
              <span>
                free after <b>20:00</b>
              </span>
            </span>
          </div>
        </WirePanel>
      </div>

      <NodePanel
        title={`Agenda // ${TODAY}`}
        right={
          <>
            <span>{events.length} events</span>
            <span>{timedTasks.length} timed tasks</span>
          </>
        }
      >
        <div className="agenda-list">
          {items.map((item, i) => (
            <div key={item.id}>
              <div
                className={`agenda-item hover-ck ${item.done ? 'done' : ''}`}
                onClick={() => setEditing(item)}
              >
                <Corners />
                <span className="agenda-time">
                  {item.time}
                  {item.end ? `-${item.end}` : ''}
                </span>
                <span className="agenda-name">
                  {item.type === 'task' && (
                    <span className={`checkbox ${item.done ? 'checked' : ''}`}>{item.done ? '✕' : ''}</span>
                  )}
                  <span>{item.name}</span>
                  {item.loc && <span className="agenda-loc">@ {item.loc}</span>}
                </span>
                <span className={catStyle[item.cat]}>{item.cat}</span>
              </div>
              {i === nowMark.after && (
                <div className="now-line">
                  <span className="line" />
                  <span className="tag cyan">{nowMark.label}</span>
                  <span className="line" />
                </div>
              )}
            </div>
          ))}
        </div>
      </NodePanel>

      <NodePanel
        title="Tasks // no set time"
        right={
          <>
            <span>
              {untimedDone} of {tasks.length} done
            </span>
            <HButton small onClick={addTask}>
              New task
            </HButton>
          </>
        }
      >
        {tasks.map((t, i) => (
          <div
            key={t.id}
            className={`task-row ${t.done ? 'done' : ''} ${dragIdx === i ? 'dragging' : ''} ${
              overIdx === i && dragIdx !== null && dragIdx !== i ? 'drag-over' : ''
            }`}
            draggable={armed === t.id}
            onDragStart={(e) => {
              setDragIdx(i)
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => {
              setDragIdx(null)
              setOverIdx(null)
              setArmed(null)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              if (overIdx !== i) setOverIdx(i)
            }}
            onDrop={(e) => {
              e.preventDefault()
              dropTask(i)
            }}
          >
            <span className={`checkbox ${t.done ? 'checked' : ''}`}>{t.done ? '✕' : ''}</span>
            {taskEdit && taskEdit.id === t.id ? (
              <input
                className="finput tinput"
                value={taskEdit.value}
                autoFocus
                placeholder="task title"
                spellCheck={false}
                onChange={(e) => setTaskEdit({ ...taskEdit, value: e.target.value })}
                onBlur={commitTask}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitTask()
                  if (e.key === 'Escape') cancelTask()
                }}
              />
            ) : (
              <span>{t.name}</span>
            )}
            <span
              className="grip"
              title="drag to reorder"
              onMouseDown={() => setArmed(t.id)}
              onMouseUp={() => setArmed(null)}
            />
          </div>
        ))}
      </NodePanel>

      {editing && (
        <AgendaEdit item={editing} onSave={saveItem} onDelete={deleteItem} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
