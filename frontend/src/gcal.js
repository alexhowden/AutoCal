// google calendar event <-> UI item adapter

export const colorToCat = {
  9: 'CLASS',
  3: 'ACADEMIC',
  5: 'SOCIAL',
  11: 'IMPORTANT',
  8: 'SKIP',
  7: 'OTHER',
}

export const catToColor = {
  CLASS: '9',
  ACADEMIC: '3',
  SOCIAL: '5',
  IMPORTANT: '11',
  SKIP: '8',
  OTHER: '7',
}

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
    cat: colorToCat[ev.colorId] || 'OTHER',
    allDay,
    date: localDate(start),
    time: allDay ? '' : hm(start),
    end: allDay ? '' : hm(end),
    startISO: ev.start?.dateTime || ev.start?.date,
    endISO: ev.end?.dateTime || ev.end?.date,
    link: ev.htmlLink,
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
    colorId: catToColor[form.cat] || '7',
  }
  const t = /^\d{1,2}:\d{2}$/
  const d = /^\d{4}-\d{2}-\d{2}$/
  if (d.test(form.date) && t.test(form.time) && t.test(form.end)) {
    body.start = { dateTime: `${form.date}T${form.time}:00`, timeZone: TZ }
    body.end = { dateTime: `${form.date}T${form.end}:00`, timeZone: TZ }
  }
  return body
}
