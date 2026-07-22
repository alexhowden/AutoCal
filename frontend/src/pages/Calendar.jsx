import { useState } from 'react'
import { VentPanel, NodePanel, PageHead, HButton } from '../components/ui.jsx'
import { weekDays, weekEvents, calTasks, todayIndex, nowHour, catStyle } from '../mock.js'

const DAY_START = 8
const DAY_END = 22
const HOUR_PX = 44

const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i)

const fmt = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`

function DayColumn({ dayIndex, label, detailed, onSelect }) {
  const events = weekEvents.filter((e) => e.day === dayIndex)
  const tasks = calTasks.filter((t) => t.day === dayIndex)
  const isToday = dayIndex === todayIndex

  return (
    <div className={`cal-day ${isToday ? 'today' : ''}`}>
      <div className="cal-daylabel">{label}</div>
      <div className="cal-lane">
        {tasks.map((t) => (
          <span key={t.id} className="cal-task">
            <span className={`checkbox ${t.done ? 'checked' : ''}`} />
            {t.name}
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
            className={`cal-event ${e.cat === 'IMPORTANT' ? 'important' : ''}`}
            style={{
              top: (e.start - DAY_START) * HOUR_PX + 1,
              height: (e.end - e.start) * HOUR_PX - 4,
            }}
            onClick={() => onSelect({ ...e, dayLabel: label })}
          >
            <span className="cal-ev-name">{e.name}</span>
            <span className="cal-ev-time">
              {fmt(e.start)} - {fmt(e.end)}
              {detailed && e.loc ? ` @ ${e.loc}` : ''}
            </span>
          </div>
        ))}
        {isToday && (
          <div className="cal-now" style={{ top: (nowHour - DAY_START) * HOUR_PX }} />
        )}
      </div>
    </div>
  )
}

export default function Calendar() {
  const [view, setView] = useState('week')
  const [selected, setSelected] = useState(null)
  const days = view === 'week' ? weekDays.map((d, i) => i) : [todayIndex]

  return (
    <>
      <PageHead title="Calendar // week 30">
        <span>jul 20 - 26</span>
        <span>tz america/new_york</span>
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
        title={view === 'week' ? 'Grid // 7 day' : `Grid // ${weekDays[todayIndex]}`}
        right={
          <>
            <span>{weekEvents.length} events</span>
            <span>{calTasks.length} tasks</span>
            <span>
              now <span className="c">18:47</span>
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
                dayIndex={di}
                label={weekDays[di]}
                detailed={view === 'day'}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>
      </VentPanel>

      {selected && (
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
                {selected.dayLabel} // {fmt(selected.start)} - {fmt(selected.end)}
              </div>
              {selected.loc && (
                <div className="cal-drow">
                  <span className="k">Where</span>
                  {selected.loc}
                </div>
              )}
              <div className="cal-drow">
                <span className="k">Type</span>
                <span className={catStyle[selected.cat]}>{selected.cat}</span>
              </div>
              <div className="cal-dbtns">
                <HButton small>Edit</HButton>
                <HButton small>Delete</HButton>
                <HButton small>Open in GCal</HButton>
              </div>
            </NodePanel>
          </div>
        </div>
      )}
    </>
  )
}
