import { useEffect, useState } from 'react'
import { NodePanel, WirePanel, RingGauge, SegBar, PageHead, Corners, HButton } from '../components/ui.jsx'
import AgendaEdit from '../components/AgendaEdit.jsx'
import { catStyle } from '../mock.js'
import {
  getEvents,
  patchEvent,
  deleteEvent,
  getTasks,
  createTask,
  patchTask,
  deleteTask,
  moveTask,
} from '../api.js'
import { toItem, toPatch, toTask, toTaskPatch, localDate, hm } from '../gcal.js'

const NEW_TASK_ID = '__new__'

export default function Dashboard() {
  const [items, setItems] = useState([])
  const [linkDown, setLinkDown] = useState(false)
  const [syncedAt, setSyncedAt] = useState(null)
  const [tasks, setTasks] = useState([])
  const [editing, setEditing] = useState(null)
  const [taskEdit, setTaskEdit] = useState(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [overIdx, setOverIdx] = useState(null)
  const [armed, setArmed] = useState(null)

  const today = localDate(new Date())

  const refreshTasks = async () => {
    try {
      setTasks((await getTasks()).map(toTask))
    } catch {
      setLinkDown(true)
    }
  }

  const refresh = async () => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    try {
      const [evs] = await Promise.all([
        getEvents(start.toISOString(), end.toISOString()),
        refreshTasks(),
      ])
      setItems(evs.map(toItem))
      setSyncedAt(hm(new Date()))
      setLinkDown(false)
    } catch {
      setLinkDown(true)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const events = items.filter((a) => a.type === 'event')
  const timedTasks = items.filter((a) => a.type === 'task')
  const allTasks = [...timedTasks, ...tasks]
  const tasksDone = allTasks.filter((t) => t.done).length
  const untimedDone = tasks.filter((t) => t.done).length

  // agenda index the NOW line sits before
  const now = new Date()
  const nowPos = items.filter((it) => !it.allDay && it.time && it.time <= hm(now)).length

  // events already behind you today - mirrors the tasks done/total ring
  const pastEvents = events.filter((e) => !e.allDay && new Date(e.endISO) <= now).length

  // schedule load: booked hours across timed events
  const bookedMs = items
    .filter((it) => !it.allDay)
    .reduce((sum, it) => sum + (new Date(it.endISO) - new Date(it.startISO)), 0)
  const bookedH = bookedMs / 3600000
  const loadFrac = Math.min(1, bookedH / 14)
  const lastEnd = items.filter((it) => !it.allDay).map((it) => it.end).sort().at(-1)

  const saveItem = async (updated) => {
    setEditing(null)
    try {
      if (updated.type === 'task') await patchTask(updated.id, toTaskPatch(updated))
      else await patchEvent(updated.id, toPatch(updated))
    } catch {
      setLinkDown(true)
    }
    refresh()
  }

  const deleteItem = async (id) => {
    const wasTask = editing?.type === 'task'
    setEditing(null)
    try {
      if (wasTask) await deleteTask(id)
      else await deleteEvent(id)
    } catch {
      setLinkDown(true)
    }
    refresh()
  }

  const toggleTask = async (t) => {
    const done = !t.done
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, done } : x)))
    try {
      await patchTask(t.id, done ? { status: 'completed' } : { status: 'needsAction', completed: null })
    } catch {
      setLinkDown(true)
      refreshTasks()
    }
  }

  const addTask = () => {
    setTasks((ts) => [{ id: NEW_TASK_ID, name: '', done: false }, ...ts])
    setTaskEdit({ id: NEW_TASK_ID, value: '' })
  }

  const commitTask = async () => {
    if (!taskEdit) return
    const name = taskEdit.value.trim()
    setTaskEdit(null)
    setTasks((ts) => ts.filter((t) => t.id !== NEW_TASK_ID))
    if (!name) return
    try {
      await createTask(name)
    } catch {
      setLinkDown(true)
    }
    refreshTasks()
  }

  const cancelTask = () => {
    if (!taskEdit) return
    setTasks((ts) => ts.filter((t) => t.id !== NEW_TASK_ID))
    setTaskEdit(null)
  }

  const dropTask = async (i) => {
    const from = dragIdx
    setDragIdx(null)
    setOverIdx(null)
    setArmed(null)
    if (from === null || from === i) return
    const next = [...tasks]
    const [moved] = next.splice(from, 1)
    next.splice(i, 0, moved)
    setTasks(next)
    try {
      await moveTask(moved.id, next[i - 1]?.id)
    } catch {
      setLinkDown(true)
      refreshTasks()
    }
  }

  return (
    <>
      <PageHead title="Dashboard">
        <b>{today}</b>
        {linkDown ? (
          <span className="tag warn">link offline</span>
        ) : (
          <span>
            sync <span className="c">{syncedAt || '...'}</span>
          </span>
        )}
      </PageHead>

      <div className="stat-row">
        <WirePanel title="Events" center>
          <RingGauge value={pastEvents} max={events.length} />
        </WirePanel>
        <WirePanel title="Tasks" center>
          <RingGauge value={tasksDone} max={allTasks.length} cyan />
        </WirePanel>
        <WirePanel title="Schedule load" right={<b className="load-pct">{Math.round(loadFrac * 100)}%</b>}>
          <div className="load-panel">
            <SegBar frac={loadFrac} hot={2} />
            <span className="micro">
              <span>
                booked <b>{bookedH.toFixed(1)}h</b>
              </span>
              <span>
                free after <b>{lastEnd || '--:--'}</b>
              </span>
            </span>
          </div>
        </WirePanel>
      </div>

      <NodePanel
        title={`Agenda // ${today}`}
        right={
          <>
            <span>{events.length} events</span>
            <span>{timedTasks.length} timed tasks</span>
          </>
        }
      >
        <div className="agenda-list">
          {items.length === 0 && (
            <div className="agenda-empty">
              {linkDown ? '// link offline - start the backend to sync' : '// nothing scheduled today'}
            </div>
          )}
          {items.map((item, i) => (
            <div key={item.id}>
              <div
                className={`agenda-item hover-ck ${item.done ? 'done' : ''}`}
                onClick={() => setEditing(item)}
              >
                <Corners />
                <span className="agenda-time">
                  {item.allDay ? 'ALL DAY' : item.time}
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
              {i === nowPos - 1 && (
                <div className="now-line">
                  <span className="line" />
                  <span className="tag cyan">NOW // {hm(now)}</span>
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
            <span
              className={`checkbox ${t.done ? 'checked' : ''}`}
              onClick={() => t.id !== NEW_TASK_ID && toggleTask(t)}
            >
              {t.done ? '✕' : ''}
            </span>
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
              <span className="task-name" onClick={() => setEditing(t)}>
                {t.name}
              </span>
            )}
            {!t.done && (
              <span
                className="grip"
                title="drag to reorder"
                onMouseDown={() => setArmed(t.id)}
                onMouseUp={() => setArmed(null)}
              />
            )}
          </div>
        ))}
      </NodePanel>

      {editing && (
        <AgendaEdit item={editing} onSave={saveItem} onDelete={deleteItem} onClose={() => setEditing(null)} />
      )}
    </>
  )
}
