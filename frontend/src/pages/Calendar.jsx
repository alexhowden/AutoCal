import { useEffect, useState } from 'react'
import { VentPanel, NodePanel, PageHead, HButton } from '../components/ui.jsx'
import AgendaEdit from '../components/AgendaEdit.jsx'
import { getEvents, patchEvent, deleteEvent } from '../api.js'
import { toItem, toPatch, hm, TZ, tagClass, isAccent, loadProtocol } from '../gcal.js'

const DAY_START = 8
const DAY_END = 22
const HOUR_PX = 44

const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i)
const DAY_NAMES = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const fmt = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`

function weekStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

function isoWeekNum(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

const hourOf = (iso) => {
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}

function DayColumn({ label, events, allDayItems, isToday, nowHour, detailed, onSelect }) {
  return (
    <div className={`cal-day ${isToday ? 'today' : ''}`}>
      <div className="cal-daylabel">{label}</div>
      <div className="cal-lane">
        {allDayItems.map((it) => (
          <span key={it.id} className="cal-task" onClick={() => onSelect({ ...it, dayLabel: label })}>
            {it.name}
          </span>
        ))}
      </div>
      <div className="cal-daybody" style={{ height: (DAY_END - DAY_START) * HOUR_PX }}>
        {hours.map((h) => (
          <i key={h} className="cal-line" style={{ top: (h - DAY_START) * HOUR_PX }} />
        ))}
        {events.map((e) => (
          <div
            key={e.id}
            className={`cal-event ${isAccent(e.cat) ? 'important' : ''} ${e.endH - e.startH <= 0.8 ? 'short' : ''}`}
            style={{
              top: (e.startH - DAY_START) * HOUR_PX + 1,
              height: (e.endH - e.startH) * HOUR_PX - 4,
            }}
            onClick={() => onSelect({ ...e, dayLabel: label })}
          >
            <span className="cal-ev-name">{e.name}</span>
            <span className="cal-ev-time">
              {e.time} - {e.end}
              {detailed && e.loc ? ` @ ${e.loc}` : ''}
            </span>
          </div>
        ))}
        {isToday && <div className="cal-now" style={{ top: (nowHour - DAY_START) * HOUR_PX }} />}
      </div>
    </div>
  )
}

export default function Calendar() {
  const [view, setView] = useState('week')
  const [items, setItems] = useState([])
  const [linkDown, setLinkDown] = useState(false)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null)

  const start = weekStart()
  const todayMid = new Date()
  todayMid.setHours(0, 0, 0, 0)
  const todayIndex = Math.round((todayMid - start) / 86400000)
  const nowHour = new Date().getHours() + new Date().getMinutes() / 60

  const dayDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
  const weekDays = dayDates.map((d, i) => `${DAY_NAMES[i]} ${d.getDate()}`)
  const last = dayDates[6]
  const range = `${MONTHS[start.getMonth()]} ${start.getDate()} - ${
    start.getMonth() === last.getMonth() ? '' : `${MONTHS[last.getMonth()]} `
  }${last.getDate()}`

  const refresh = async () => {
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    try {
      await loadProtocol()
      const evs = await getEvents(start.toISOString(), end.toISOString())
      setItems(evs.map(toItem))
      setLinkDown(false)
    } catch {
      setLinkDown(true)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  // position timed events on the grid, clamped to visible hours
  const dayIndexOf = (it) => Math.round((new Date(it.startISO).setHours(0, 0, 0, 0) - start) / 86400000)
  const timed = items
    .filter((it) => !it.allDay)
    .map((it) => ({
      ...it,
      day: dayIndexOf(it),
      startH: Math.max(DAY_START, Math.min(DAY_END - 0.5, hourOf(it.startISO))),
      endH: Math.max(DAY_START + 0.5, Math.min(DAY_END, hourOf(it.endISO))),
    }))
  const allDay = items.filter((it) => it.allDay)

  const days = view === 'week' ? weekDays.map((_, i) => i) : [todayIndex]

  const saveItem = async (updated) => {
    setEditing(null)
    try {
      await patchEvent(updated.id, toPatch(updated))
    } catch {
      setLinkDown(true)
    }
    refresh()
  }

  const deleteItem = async (id) => {
    setEditing(null)
    setSelected(null)
    try {
      await deleteEvent(id)
    } catch {
      setLinkDown(true)
    }
    refresh()
  }

  return (
    <>
      <PageHead title={`Calendar // week ${isoWeekNum(new Date())}`}>
        <span>{range}</span>
        <span>tz {TZ.toLowerCase()}</span>
        {linkDown && <span className="tag warn">link offline</span>}
      </PageHead>

      <div className="filter-row">
        {['week', 'day'].map((v) => (
          <button
            key={v}
            className={`filter-chip ${view === v ? 'active' : ''}`}
            onClick={() => setView(v)}
          >
            {v}
          </button>
        ))}
      </div>

      <VentPanel
        title={view === 'week' ? 'Grid // 7 day' : `Grid // ${weekDays[todayIndex] || 'today'}`}
        right={
          <>
            <span>{timed.length} events</span>
            <span>{allDay.length} all-day</span>
            <span>
              now <span className="c">{hm(new Date())}</span>
            </span>
          </>
        }
      >
        <div className="cal-scroll">
          <div className="cal-grid">
            <div className="cal-timecol">
              <div className="cal-daylabel" />
              <div className="cal-lane" style={{ borderBottomColor: 'transparent' }} />
              {hours.map((h) => (
                <div key={h} className="cal-hour">
                  {fmt(h)}
                </div>
              ))}
            </div>
            {days.map((di) => (
              <DayColumn
                key={di}
                label={weekDays[di]}
                events={timed.filter((e) => e.day === di)}
                allDayItems={allDay.filter((it) => dayIndexOf(it) === di)}
                isToday={di === todayIndex}
                nowHour={nowHour}
                detailed={view === 'day'}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>
      </VentPanel>

      {selected && !editing && (
        <div className="cal-detail-backdrop" onClick={() => setSelected(null)}>
          <div className="cal-detail" onClick={(e) => e.stopPropagation()}>
            <NodePanel
              title={selected.name}
              right={
                <button className="cal-x" onClick={() => setSelected(null)}>
                  ✕
                </button>
              }
            >
              <div className="cal-drow">
                <span className="k">When</span>
                {selected.dayLabel} //{' '}
                {selected.allDay ? 'all day' : `${selected.time} - ${selected.end}`}
              </div>
              {selected.loc && (
                <div className="cal-drow">
                  <span className="k">Where</span>
                  {selected.loc}
                </div>
              )}
              <div className="cal-drow">
                <span className="k">Type</span>
                <span className={tagClass(selected.cat)}>{selected.cat}</span>
              </div>
              <div className="cal-dbtns">
                <HButton small onClick={() => setEditing(selected)}>
                  Edit
                </HButton>
                <HButton small onClick={() => deleteItem(selected.id)}>
                  Delete
                </HButton>
                <HButton small onClick={() => selected.link && window.open(selected.link, '_blank')}>
                  Open in GCal
                </HButton>
              </div>
            </NodePanel>
          </div>
        </div>
      )}

      {editing && (
        <AgendaEdit
          item={editing}
          onSave={saveItem}
          onDelete={deleteItem}
          onClose={() => {
            setEditing(null)
            setSelected(null)
          }}
        />
      )}
    </>
  )
}
