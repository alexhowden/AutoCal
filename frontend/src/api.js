export const API = 'http://127.0.0.1:8787'

// one conversation per app launch - the backend keys agent sessions on this
export const sessionId = crypto.randomUUID()
export const sessionTag = sessionId.slice(0, 4)

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
