import { createContext, useContext, useState } from 'react'
import { streamChat } from './api.js'

const OFFLINE_MSG =
  '// LINK OFFLINE - backend not reachable on 127.0.0.1:8787. Start it with: uvicorn src.server:app --port 8787'

const ChatCtx = createContext(null)

// chat state lives above the page component so switching tabs doesn't wipe
// the transcript, and an in-flight stream keeps going in the background
export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [files, setFiles] = useState([])
  const [thinking, setThinking] = useState(false)

  const send = async () => {
    if ((!input.trim() && files.length === 0) || thinking) return
    const mine = {
      id: Date.now(),
      from: 'user',
      text: input.trim(),
      file: files[0] || null,
    }
    setMessages((m) => [...m, mine])
    setInput('')
    setFiles([])
    setThinking(true)

    const replyId = mine.id + 1
    // update-or-append the streaming agent message, built from ordered parts
    const patch = (fn) =>
      setMessages((m) => {
        const existing = m.find((x) => x.id === replyId)
        if (!existing) return [...m, { id: replyId, from: 'agent', parts: fn([]) }]
        return m.map((x) => (x.id === replyId ? { ...x, parts: fn(x.parts) } : x))
      })

    try {
      await streamChat(mine.text, (ev) => {
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
      setMessages((m) => [
        ...m,
        { id: replyId, from: 'agent', parts: [{ t: 'text', text: OFFLINE_MSG, err: true }] },
      ])
    }
    setThinking(false)
  }

  return (
    <ChatCtx.Provider value={{ messages, input, setInput, files, setFiles, thinking, send }}>
      {children}
    </ChatCtx.Provider>
  )
}

export const useChat = () => useContext(ChatCtx)
