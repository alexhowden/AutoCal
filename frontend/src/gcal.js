// google calendar event <-> UI item adapter
import { getSettings } from './api.js'

// google's modern UI palette - colors.get still serves the pre-redesign hexes,
// so these are hardcoded to match what the user actually sees in google calendar
export const PALETTE = {
  1: { name: 'Lavender', hex: '#7986cb' },
  2: { name: 'Sage', hex: '#33b679' },
  3: { name: 'Grape', hex: '#8e24aa' },
  4: { name: 'Flamingo', hex: '#e67c73' },
  5: { name: 'Banana', hex: '#f6bf26' },
  6: { name: 'Tangerine', hex: '#f4511e' },
  7: { name: 'Peacock', hex: '#039be5' },
  8: { name: 'Graphite', hex: '#616161' },
  9: { name: 'Blueberry', hex: '#3f51b5' },
  10: { name: 'Basil', hex: '#0b8043' },
  11: { name: 'Tomato', hex: '#d50000' },
}

export const DEFAULT_CATS = [
  { name: 'CLASS', colorId: '9' },
  { name: 'ACADEMIC', colorId: '3' },
  { name: 'SOCIAL', colorId: '5' },
  { name: 'IMPORTANT', colorId: '11' },
  { name: 'SKIP', colorId: '8' },
  { name: 'OTHER', colorId: '7' },
]

// user-editable category protocol, loaded from settings; last row is the fallback
let cats = DEFAULT_CATS
let loading = null

export const setCats = (next) => {
  if (next?.length) cats = next
}

export const getCats = () => cats

export function loadProtocol() {
  if (!loading) {
    loading = getSettings()
      .then((s) => setCats(s.categories))
      .catch(() => {})
  }
  return loading
}

export const colorToCat = (colorId) =>
  (cats.find((c) => c.colorId === String(colorId)) || cats[cats.length - 1]).name

export const catToColor = (name) =>
  (cats.find((c) => c.name === name) || cats[cats.length - 1]).colorId

// the tomato-red category doubles as the "important" accent everywhere
export const isAccent = (name) => catToColor(name) === '11'

export const tagClass = (name) => (isAccent(name) ? 'tag warn' : 'tag')

export const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone

const pad = (n) => String(n).padStart(2, '0')

export const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

export const localDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// google event resource -> flat item the pages and edit modal work with
export function toItem(ev) {
  const allDay = !ev.start?.dateTime
  const start = new Date(ev.start?.dateTime || `${ev.start?.date}T00:00:00`)
  const end = new Date(ev.end?.dateTime || `${ev.end?.date}T00:00:00`)
  return {
    id: ev.id,
    type: 'event',
    name: ev.summary || '(untitled)',
    loc: ev.location || '',
    desc: ev.description || '',
    cat: colorToCat(ev.colorId),
    allDay,
    date: localDate(start),
    time: allDay ? '' : hm(start),
    end: allDay ? '' : hm(end),
    startISO: ev.start?.dateTime || ev.start?.date,
    endISO: ev.end?.dateTime || ev.end?.date,
    link: ev.htmlLink,
    account: ev.account || '',
  }
}

// google task resource -> flat item
export function toTask(t) {
  return {
    id: t.id,
    type: 'task',
    name: t.title || '',
    done: t.status === 'completed',
    desc: t.notes || '',
    date: t.due ? t.due.slice(0, 10) : '',
    time: '',
    end: '',
  }
}

// task edit-form -> google tasks patch body (due is date-only in the API)
export function toTaskPatch(form) {
  const body = {
    title: form.name,
    notes: form.desc,
    status: form.done ? 'completed' : 'needsAction',
  }
  if (!form.done) body.completed = null
  body.due = /^\d{4}-\d{2}-\d{2}$/.test(form.date) ? `${form.date}T00:00:00.000Z` : null
  return body
}

// edit-modal form -> google patch body
export function toPatch(form) {
  const body = {
    summary: form.name,
    location: form.loc,
    description: form.desc,
    colorId: catToColor(form.cat),
  }
  const t = /^\d{1,2}:\d{2}$/
  const d = /^\d{4}-\d{2}-\d{2}$/
  if (d.test(form.date) && t.test(form.time) && t.test(form.end)) {
    body.start = { dateTime: `${form.date}T${form.time}:00`, timeZone: TZ }
    body.end = { dateTime: `${form.date}T${form.end}:00`, timeZone: TZ }
  }
  return body
}
