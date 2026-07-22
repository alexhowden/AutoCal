export const TODAY = '2026-07-21'

export const agenda = [
  { id: 1, time: '09:00', end: '10:00', name: 'CS 3110 Lecture', loc: 'Hollister B14', cat: 'CLASS', type: 'event' },
  { id: 2, time: '11:00', end: '12:00', name: 'Office Hours - Prof. Chen', loc: 'Gates 341', cat: 'ACADEMIC', type: 'event' },
  { id: 3, time: '14:00', end: '15:00', name: 'Advisor Meeting', loc: 'Zoom', cat: 'IMPORTANT', type: 'event' },
  { id: 4, time: '16:00', name: 'Submit internship application', cat: 'TASK', type: 'task', done: true },
  { id: 5, time: '19:00', end: '21:00', name: 'Climbing Club', loc: 'Lindseth Center', cat: 'SOCIAL', type: 'event' },
  { id: 6, time: '23:59', name: 'Finish PS4 - due tonight', cat: 'TASK', type: 'task', done: false },
]

export const untimedTasks = [
  { id: 7, name: 'Email Prof. Chen about the regrade', done: false },
  { id: 8, name: 'Order ECE 2300 textbook', done: false },
  { id: 9, name: 'Pick classes for fall enrollment', done: true },
]

export const nowMark = { after: 3, label: 'NOW // 18:47' }

export const catStyle = {
  CLASS: 'tag',
  ACADEMIC: 'tag',
  SOCIAL: 'tag',
  IMPORTANT: 'tag warn',
  TASK: 'tag',
  SKIP: 'tag',
  OTHER: 'tag',
}

export const activityLog = [
  { time: '18:42:07', kind: 'CREATE', text: 'EVT <b>Advisor Meeting</b> 2026-07-22 14:00 // colorId 11' },
  { time: '18:41:52', kind: 'SEARCH', text: 'scanned 2026-07-22 09:00-17:00 for conflicts // none found' },
  { time: '16:03:19', kind: 'IMPORT', text: '<b>syllabus_cs3110.pdf</b> parsed // 9 items extracted // 9 added' },
  { time: '16:02:44', kind: 'CREATE', text: 'TASK <b>PS1 due</b> 2026-09-04 23:59 // colorId 11' },
  { time: '12:20:31', kind: 'EDIT', text: 'EVT <b>Climbing Club</b> moved 18:00 → 19:00' },
  { time: '12:19:58', kind: 'SEARCH', text: 'located eventId for "climbing" via cal_view_events' },
  { time: '09:12:02', kind: 'DELETE', text: 'EVT <b>Dentist (duplicate)</b> removed from primary' },
  { time: '08:00:00', kind: 'SYNC', text: 'google calendar link refreshed // token ok' },
]

export const seedMessages = [
  { id: 1, from: 'user', text: 'add my advisor meeting tomorrow at 2pm, it’s on zoom' },
  {
    id: 2,
    from: 'agent',
    text: 'Done. Created "Advisor Meeting" for tomorrow 14:00-15:00 (Zoom), flagged important. No conflicts in the surrounding window.',
  },
  {
    id: 3,
    from: 'user',
    file: { name: 'syllabus_cs3110.pdf', size: '214 KB' },
    text: 'import this',
  },
  {
    id: 4,
    from: 'agent',
    text: 'Parsed CS 3110 syllabus. Extracted 9 dated items: 6 problem sets, 2 prelims, 1 final. All added to your agenda with exam dates flagged important. Say "undo" to roll any of them back.',
  },
]

export const weekDays = ['MON 20', 'TUE 21', 'WED 22', 'THU 23', 'FRI 24', 'SAT 25', 'SUN 26']
export const todayIndex = 1
export const nowHour = 18.78

export const weekEvents = [
  { id: 'w1', day: 0, start: 9, end: 10, name: 'CS 3110 Lecture', loc: 'Hollister B14', cat: 'CLASS' },
  { id: 'w2', day: 2, start: 9, end: 10, name: 'CS 3110 Lecture', loc: 'Hollister B14', cat: 'CLASS' },
  { id: 'w3', day: 4, start: 9, end: 10, name: 'CS 3110 Lecture', loc: 'Hollister B14', cat: 'CLASS' },
  { id: 'w4', day: 0, start: 15, end: 17, name: 'Lab Section', loc: 'Phillips 318', cat: 'CLASS' },
  { id: 'w5', day: 1, start: 11, end: 12, name: 'Office Hours - Prof. Chen', loc: 'Gates 341', cat: 'ACADEMIC' },
  { id: 'w6', day: 1, start: 19, end: 21, name: 'Climbing Club', loc: 'Lindseth Center', cat: 'SOCIAL' },
  { id: 'w7', day: 2, start: 14, end: 15, name: 'Advisor Meeting', loc: 'Zoom', cat: 'IMPORTANT' },
  { id: 'w8', day: 3, start: 13, end: 14, name: 'CS 3110 Discussion', loc: 'Upson 216', cat: 'CLASS' },
  { id: 'w9', day: 3, start: 18, end: 20, name: 'Prelim Review', loc: 'Statler Aud', cat: 'ACADEMIC' },
  { id: 'w10', day: 4, start: 17, end: 18.5, name: 'Gym w/ Sam', loc: 'Helen Newman', cat: 'SOCIAL' },
  { id: 'w11', day: 6, start: 11, end: 12.5, name: 'Brunch', loc: 'CTB', cat: 'SOCIAL' },
]

export const calTasks = [
  { id: 't1', day: 1, name: 'Finish PS4', done: false },
  { id: 't2', day: 1, name: 'Email Prof. Chen', done: false },
  { id: 't3', day: 4, name: 'Order textbook', done: false },
]

export const colorProtocol = [
  { cat: 'Classes', id: 'colorId 9', hex: '#3f51b5' },
  { cat: 'Academics', id: 'colorId 3', hex: '#8e24aa' },
  { cat: 'Social', id: 'colorId 5', hex: '#f6bf26' },
  { cat: 'Important', id: 'colorId 11', hex: '#d50000' },
  { cat: 'Not attending', id: 'colorId 8', hex: '#616161' },
  { cat: 'Everything else', id: 'colorId 7', hex: '#039be5' },
]
