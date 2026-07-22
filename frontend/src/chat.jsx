import { createContext, useContext, useState } from 'react'
import { streamChat, closeChatSession } from './api.js'

const OFFLINE_MSG =
  '// LINK OFFLINE - backend not reachable on 127.0.0.1:8787. Start it with: uvicorn src.server:app --port 8787'

const ChatCtx = createContext(null)

const makeSession = () => ({ id: crypto.randomUUID(), messages: [], thinking: false })

// chat state lives above the page component so switching tabs doesn't wipe
// transcripts, and an in-flight stream keeps going in the background.
// each session maps to its own agent conversation on the backend.
export function ChatProvider({ children }) {
  const [sessions, setSessions] = useState(() => [makeSession()])
  const [activeId, setActiveId] = useState(null)
  const [input, setInput] = useState('')
  const [files, setFiles] = useState([])

  const active = sessions.find((s) => s.id === activeId) ?? sessions[0]

  const patchSession = (id, fn) => setSessions((ss) => ss.map((s) => (s.id === id ? fn(s) : s)))

  const send = async () => {
    const sess = active
    if ((!input.trim() && files.length === 0) || sess.thinking) return
    const mine = {
      id: Date.now(),
      from: 'user',
      text: input.trim(),
      file: files[0] || null,
    }
    patchSession(sess.id, (s) => ({ ...s, thinking: true, messages: [...s.messages, mine] }))
    setInput('')
    setFiles([])

    const replyId = mine.id + 1
    // update-or-append the streaming agent message, built from ordered parts
    const patch = (fn) =>
      patchSession(sess.id, (s) => {
        const existing = s.messages.find((x) => x.id === replyId)
        const messages = existing
          ? s.messages.map((x) => (x.id === replyId ? { ...x, parts: fn(x.parts) } : x))
          : [...s.messages, { id: replyId, from: 'agent', parts: fn([]) }]
        return { ...s, messages }
      })

    try {
      await streamChat(sess.id, mine.text, (ev) => {
        patch((parts) => {
          const last = parts[parts.length - 1]
          if (ev.type === 'text') {
            if (last?.t === 'text' && !last.closed)
              return [...parts.slice(0, -1), { ...last, text: last.text + ev.text }]
            return [...parts, { t: 'text', text: ev.text }]
          }
          if (ev.type === 'tool') return [...parts, { t: 'tool', name: ev.name }]
          if (ev.type === 'break') {
            if (last?.t === 'text') return [...parts.slice(0, -1), { ...last, closed: true }]
            return parts
          }
          if (ev.type === 'done') {
            if (!parts.some((p) => p.t === 'text') && ev.result)
              return [...parts, { t: 'text', text: ev.result }]
            return parts
          }
          if (ev.type === 'error')
            return [...parts, { t: 'text', text: `// AGENT ERROR - ${ev.message}`, err: true }]
          return parts
        })
      })
    } catch {
      patchSession(sess.id, (s) => ({
        ...s,
        messages: [
          ...s.messages,
          { id: replyId, from: 'agent', parts: [{ t: 'text', text: OFFLINE_MSG, err: true }] },
        ],
      }))
    }
    patchSession(sess.id, (s) => ({ ...s, thinking: false }))
  }

  const addSession = () => {
    const s = makeSession()
    setSessions((ss) => [...ss, s])
    setActiveId(s.id)
  }

  const closeSession = (id) => {
    setSessions((ss) => {
      const rest = ss.filter((s) => s.id !== id)
      return rest.length ? rest : [makeSession()]
    })
    if (id === activeId) setActiveId(null)
    closeChatSession(id).catch(() => {})
  }

  const value = {
    sessions,
    active,
    selectSession: setActiveId,
    addSession,
    closeSession,
    input,
    setInput,
    files,
    setFiles,
    send,
  }

  return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>
}

export const useChat = () => useContext(ChatCtx)
