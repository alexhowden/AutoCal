export const API = 'http://127.0.0.1:8787'

// one conversation per app launch - the backend keys agent sessions on this
export const sessionId = crypto.randomUUID()
export const sessionTag = sessionId.slice(0, 4)

async function req(path, opts) {
  const res = await fetch(`${API}${path}`, opts)
  if (!res.ok) throw new Error(`http ${res.status}`)
  return res.json()
}

export const getEvents = (timeMin, timeMax) =>
  req(`/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)

export const patchEvent = (id, body) =>
  req(`/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const deleteEvent = (id) => req(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' })

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

// POST to an SSE endpoint and invoke onEvent for each parsed `data:` payload
export async function streamChat(message, onEvent) {
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
