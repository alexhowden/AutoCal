import { useEffect, useRef, useState } from 'react'
import { NodePanel, WirePanel, PageHead, Corners, HButton } from '../components/ui.jsx'
import AgendaEdit from '../components/AgendaEdit.jsx'
import {
  getEvents,
  createEvent,
  patchEvent,
  deleteEvent,
  getTasks,
  createTask,
  patchTask,
  deleteTask,
  moveTask,
} from '../api.js'
import { toItem, toPatch, toTask, toTaskPatch, localDate, hm, tagClass, getCats, loadProtocol } from '../gcal.js'
import { useFx, APP_T0 } from '../fx.jsx'

const NEW_TASK_ID = '__new__'

// events gauge: layered HUD reticle (fine tick scale, segmented arc,
// glowing core, slow-rotating accent, cardinal nodes)
function ReticleGauge({ value, max, label }) {
  const frac = Math.min(max ? value / max : 0, 1)
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(frac))
    return () => cancelAnimationFrame(id)
  }, [frac])
  const N = 24
  const lit = Math.round(shown * N)
  const pt = (deg, r) => [60 + r * Math.cos((deg * Math.PI) / 180), 60 + r * Math.sin((deg * Math.PI) / 180)]
  const seg = (i, r) => {
    const span = 360 / N - 4
    const a0 = (i * 360) / N - 90 + 2
    const [x0, y0] = pt(a0, r)
    const [x1, y1] = pt(a0 + span, r)
    return `M ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1}`
  }
  return (
    <svg className="ret" viewBox="0 0 120 120" width="128" height="128" style={{ color: 'var(--red)' }}>
      <circle className="ret-hair" cx="60" cy="60" r="54" />
      {Array.from({ length: 60 }, (_, i) => {
        const a = i * 6 - 90
        const major = i % 5 === 0
        const [x0, y0] = pt(a, 54)
        const [x1, y1] = pt(a, major ? 50 : 52)
        return <line key={i} className={`ret-tick ${major ? 'major' : ''}`} x1={x0} y1={y0} x2={x1} y2={y1} />
      })}
      {Array.from({ length: N }, (_, i) => (
        <path
          key={i}
          className={`ret-seg ${i < lit ? 'lit' : ''}`}
          d={seg(i, 42)}
          style={{
            transitionDelay: `${i * 25}ms`,
            animationDelay: `calc(var(--pd, 0ms) + ${Math.round(i * (1200 / N))}ms)`,
          }}
        />
      ))}
      <circle className="ret-hair inner" cx="60" cy="60" r="33" />
      <circle className="ret-core" cx="60" cy="60" r="27" style={{ opacity: 0.2 + shown * 0.8 }} />
      <g className="ret-spin">
        <path className="ret-accent" d="M 60 8 A 52 52 0 0 1 112 60" />
      </g>
      {[0, 90, 180, 270].map((a) => {
        const [x, y] = pt(a, 54)
        return <circle key={a} className="ret-node" cx={x} cy={y} r="2.2" />
      })}
      <text className="ret-val" x="60" y="58">
        {value}
        <tspan className="ret-max">/{max}</tspan>
      </text>
      <text className="ret-label" x="60" y="74">
        {label}
      </text>
    </svg>
  )
}

// tasks gauge: orbital (smooth arc with glowing head node, crosshairs,
// counter-rotating dashed inner ring)
function OrbitalGauge({ value, max, label, cyan = false }) {
  const frac = Math.min(max ? value / max : 0, 1)
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(frac))
    return () => cancelAnimationFrame(id)
  }, [frac])
  const pt = (deg, r) => [60 + r * Math.cos((deg * Math.PI) / 180), 60 + r * Math.sin((deg * Math.PI) / 180)]
  const r = 45
  const c = 2 * Math.PI * r
  const [hx, hy] = pt(-90 + shown * 360, r)
  return (
    <svg
      className="orb"
      viewBox="0 0 120 120"
      width="128"
      height="128"
      style={{ color: cyan ? 'var(--cyan-data)' : 'var(--red)' }}
    >
      <circle className="ret-hair" cx="60" cy="60" r="54" />
      {Array.from({ length: 60 }, (_, i) => {
        const a = i * 6 - 90
        const major = i % 5 === 0
        const [x0, y0] = pt(a, 54)
        const [x1, y1] = pt(a, major ? 50 : 52)
        return <line key={i} className={`ret-tick ${major ? 'major' : ''}`} x1={x0} y1={y0} x2={x1} y2={y1} />
      })}
      {[45, 135, 225, 315].map((a) => {
        const [x0, y0] = pt(a, 26)
        const [x1, y1] = pt(a, 58)
        return <line key={a} className="orb-cross" x1={x0} y1={y0} x2={x1} y2={y1} />
      })}
      <circle className="orb-track" cx="60" cy="60" r={r} />
      <circle
        className="orb-arc"
        cx="60"
        cy="60"
        r={r}
        strokeDasharray={`${c * shown} ${c}`}
        transform="rotate(-90 60 60)"
      />
      <circle className="orb-head" cx={hx} cy={hy} r="3.5" />
      <g className="orb-spin">
        <circle className="orb-dash" cx="60" cy="60" r="33.1" />
      </g>
      <text className="ret-val" x="60" y="58">
        {value}
        <tspan className="ret-max">/{max}</tspan>
      </text>
      <text className="ret-label" x="60" y="74">
        {label}
      </text>
    </svg>
  )
}

// temporary demo widget: race-car boost gauge - dial starts at the bottom of
// the circle and sweeps 270 degrees clockwise (through left and top) to the right
const GAUGE_MAX = 8
const GAUGE_REDLINE = 6.5
const GAUGE_A0 = 90
const GAUGE_SWEEP = 270

function BoostGauge({ value }) {
  const frac = Math.min(value / GAUGE_MAX, 1)
  // motorcycle-cluster boot, ONCE per mount: peg the needle at redline, then
  // settle to the real value. later value changes glide straight there.
  const [sweep, setSweep] = useState({ v: 0, dur: 0.85, ease: 'cubic-bezier(.3, .9, .4, 1)' })
  const target = useRef(frac)
  const booted = useRef(false)
  target.current = frac
  useEffect(() => {
    let t
    const id = requestAnimationFrame(() => {
      setSweep({ v: 1, dur: 0.85, ease: 'cubic-bezier(.3, .9, .4, 1)' })
      t = setTimeout(() => {
        booted.current = true
        setSweep({ v: target.current, dur: 1.6, ease: 'cubic-bezier(.3, 1.12, .45, 1)' })
      }, 1000)
    })
    return () => {
      cancelAnimationFrame(id)
      clearTimeout(t)
    }
  }, [])
  useEffect(() => {
    if (booted.current) setSweep({ v: frac, dur: 1.2, ease: 'cubic-bezier(.3, 1.12, .45, 1)' })
  }, [frac])
  const swept = sweep.v

  const pt = (deg, radius) => {
    const rad = (deg * Math.PI) / 180
    return [60 + radius * Math.cos(rad), 60 + radius * Math.sin(rad)]
  }
  const arc = (fromDeg, toDeg, radius) => {
    const [x0, y0] = pt(fromDeg, radius)
    const [x1, y1] = pt(toDeg, radius)
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${toDeg - fromDeg > 180 ? 1 : 0} 1 ${x1} ${y1}`
  }

  const ticks = []
  for (let i = 0; i <= GAUGE_MAX * 2; i++) {
    const v = i / 2
    const major = i % 2 === 0
    const a = GAUGE_A0 + (v / GAUGE_MAX) * GAUGE_SWEEP
    ticks.push({ v, a, major, hot: v >= GAUGE_REDLINE })
  }

  return (
    <svg className="boost" viewBox="0 0 120 120" width="136" height="136">
      <path className="boost-track" d={arc(GAUGE_A0, GAUGE_A0 + GAUGE_SWEEP, 52)} />
      <path
        className="boost-redzone"
        d={arc(GAUGE_A0 + (GAUGE_REDLINE / GAUGE_MAX) * GAUGE_SWEEP, GAUGE_A0 + GAUGE_SWEEP, 52)}
      />
      {ticks.map((t, i) => {
        const [x0, y0] = pt(t.a, 52)
        const [x1, y1] = pt(t.a, t.major ? 44 : 48)
        return (
          <line
            key={i}
            className={`boost-tick ${t.major ? 'major' : ''} ${t.hot ? 'hot' : ''}`}
            x1={x0}
            y1={y0}
            x2={x1}
            y2={y1}
          />
        )
      })}
      {ticks
        .filter((t) => t.major)
        .map((t) => {
          const [nx, ny] = pt(t.a, 35)
          return (
            <text key={t.v} className={`boost-num ${t.hot ? 'hot' : ''}`} x={nx} y={ny}>
              {t.v}
            </text>
          )
        })}
      <text className="boost-label" x="60" y="46">
        LOAD
      </text>
      <g
        className="boost-needle"
        style={{
          transform: `rotate(${swept * GAUGE_SWEEP}deg)`,
          transition: `transform ${sweep.dur}s ${sweep.ease}`,
        }}
      >
        <path d="M 58.2 58 L 59.2 104 L 60.8 104 L 61.8 58 Z" />
      </g>
      <circle className="boost-hub" cx="60" cy="60" r="5" />
      <text className="boost-val" x="93" y="92">
        {Math.round(frac * 100)}%
      </text>
    </svg>
  )
}

export default function Dashboard() {
  const { fx } = useFx()
  // phase offset locking the card pulses to the sidebar loop - computed ONCE:
  // recomputing per render changes animation-delay and restarts every pulse
  // animation, which reads as the gauges trembling
  const [pulsePhase] = useState(() => `${-((performance.now() - APP_T0) % 6000)}ms`)
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
        loadProtocol(),
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

  // hide tasks due more than a week out; undated ones always show
  const horizon = new Date()
  horizon.setDate(horizon.getDate() + 7)
  const weekTasks = tasks.filter((t) => !t.date || t.date <= localDate(horizon))
  const allTasks = [...timedTasks, ...weekTasks]
  const tasksDone = allTasks.filter((t) => t.done).length
  const untimedDone = weekTasks.filter((t) => t.done).length

  const fmtDue = (iso) => {
    if (iso === today) return 'today'
    const d = new Date(`${iso}T00:00:00`)
    return `${['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'][d.getMonth()]} ${d.getDate()}`
  }

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
  const lastEnd = items.filter((it) => !it.allDay).map((it) => it.end).sort().at(-1)

  const newEvent = () => {
    const startH = Math.min(22, now.getHours() + 1)
    setEditing({
      id: null,
      isNew: true,
      type: 'event',
      name: '',
      date: today,
      time: `${String(startH).padStart(2, '0')}:00`,
      end: `${String(startH + 1).padStart(2, '0')}:00`,
      loc: '',
      cat: getCats().at(-1).name,
      desc: '',
    })
  }

  const saveItem = async (updated) => {
    setEditing(null)
    try {
      if (updated.type === 'task') {
        await patchTask(updated.id, toTaskPatch(updated))
      } else if (updated.isNew) {
        const body = toPatch(updated)
        if (!body.start) {
          // times didn't parse - fall back to an all-day event on the chosen date
          const d = new Date(`${updated.date || today}T00:00:00`)
          const nx = new Date(d)
          nx.setDate(nx.getDate() + 1)
          body.start = { date: localDate(d) }
          body.end = { date: localDate(nx) }
        }
        await createEvent(body)
      } else {
        await patchEvent(updated.id, toPatch(updated), updated.account)
      }
    } catch {
      setLinkDown(true)
    }
    refresh()
  }

  const deleteItem = async (id) => {
    if (!id) {
      setEditing(null)
      return
    }
    const wasTask = editing?.type === 'task'
    const account = editing?.account
    setEditing(null)
    try {
      if (wasTask) await deleteTask(id)
      else await deleteEvent(id, account)
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

  // drag indices are within the filtered week list - map back to the full list by id
  const dropTask = async (i) => {
    const from = dragIdx
    setDragIdx(null)
    setOverIdx(null)
    setArmed(null)
    if (from === null || from === i) return
    const movedId = weekTasks[from].id
    const targetId = weekTasks[i].id
    const next = [...tasks]
    const [moved] = next.splice(next.findIndex((t) => t.id === movedId), 1)
    const insertAt = next.findIndex((t) => t.id === targetId) + (from < i ? 1 : 0)
    next.splice(insertAt, 0, moved)
    setTasks(next)
    try {
      await moveTask(moved.id, next[insertAt - 1]?.id)
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

      <div className="stat-row" style={{ '--pd': pulsePhase }}>
        <WirePanel
          title="Events"
          center
          className={fx.tabPulse ? 'wp-pulse' : ''}
        >
          <ReticleGauge value={pastEvents} max={events.length} label="EVENTS" />
        </WirePanel>
        <WirePanel
          title="Tasks"
          center
          className={fx.tabPulse ? 'wp-pulse' : ''}
        >
          <OrbitalGauge value={tasksDone} max={allTasks.length} label="TASKS" cyan />
        </WirePanel>
        <WirePanel title="Schedule load" center>
          <div className="gauge-card">
            <BoostGauge value={bookedH} />
            <span className="micro">
              free after <b>{lastEnd || '--:--'}</b>
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
            <HButton small onClick={newEvent}>
              New event
            </HButton>
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
                <span className={tagClass(item.cat)}>{item.cat}</span>
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
        title="Tasks // next 7 days"
        right={
          <>
            <span>
              {untimedDone} of {weekTasks.length} done
            </span>
            <HButton small onClick={addTask}>
              New task
            </HButton>
          </>
        }
      >
        {weekTasks.map((t, i) => (
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
            {t.date && <span className="task-date">{fmtDue(t.date)}</span>}
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
