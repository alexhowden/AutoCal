export const API = 'http://127.0.0.1:8787'

async function req(path, opts) {
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) throw new Error(`http ${res.status}`)
  return res.json()
}

export const getEvents = (timeMin, timeMax) =>
  req(`/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)

const acctQ = (account) => (account ? `?account=${encodeURIComponent(account)}` : '')

export const patchEvent = (id, body, account) =>
  req(`/events/${encodeURIComponent(id)}${acctQ(account)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const deleteEvent = (id, account) =>
  req(`/events/${encodeURIComponent(id)}${acctQ(account)}`, { method: 'DELETE' })

const json = (body) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const getTasks = () => req('/tasks')

export const createTask = (title) => req('/tasks', { method: 'POST', ...json({ title }) })

export const patchTask = (id, body) =>
  req(`/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', ...json(body) })

export const deleteTask = (id) => req(`/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const moveTask = (id, previous) =>
  req(`/tasks/${encodeURIComponent(id)}/move${previous ? `?previous=${encodeURIComponent(previous)}` : ''}`, {
    method: 'POST',
  })

export const getActivity = () => req('/activity')

export const getNotes = () => req('/notes')

export const createNote = (text) => req('/notes', { method: 'POST', ...json({ text }) })

export const patchNote = (id, text) =>
  req(`/notes/${encodeURIComponent(id)}`, { method: 'PATCH', ...json({ text }) })

export const deleteNoteApi = (id) => req(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const getSettings = () => req('/settings')

export const patchSettings = (patch) => req('/settings', { method: 'PATCH', ...json(patch) })

export const getStatus = () => req('/status')

export const reauthGoogle = () => req('/auth/google', { method: 'POST' })

export const closeChatSession = (id) => req(`/chat/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const unlinkAccount = (email) => req(`/accounts/${encodeURIComponent(email)}`, { method: 'DELETE' })

// POST to an SSE endpoint and invoke onEvent for each parsed `data:` payload;
// the backend keys agent conversations on sessionId
export async function streamChat(sessionId, message, onEvent) {
  const res = await fetch(`${API}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: sessionId, message }),
  })
  if (!res.ok || !res.body) throw new Error(`http ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const chunks = buf.split('\n\n')
    buf = chunks.pop()
    for (const chunk of chunks) {
      const line = chunk.split('\n').find((l) => l.startsWith('data: '))
      if (line) onEvent(JSON.parse(line.slice(6)))
    }
  }
}
