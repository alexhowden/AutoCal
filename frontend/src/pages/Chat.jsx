import { useEffect, useRef, useState } from 'react'
import { Panel, SegBar, PageHead, Corners, HButton } from '../components/ui.jsx'
import { streamChat, sessionTag } from '../api.js'
import { inline } from '../md.jsx'

const OFFLINE_MSG =
  '// LINK OFFLINE - backend not reachable on 127.0.0.1:8787. Start it with: uvicorn src.server:app --port 8787'

function formatSize(bytes) {
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

// interleave text blocks and tool chips in stream order; consecutive chips share a row
function renderParts(parts) {
  const out = []
  let chips = []
  let k = 0
  const flush = () => {
    if (chips.length) {
      out.push(
        <div key={k++} className="tool-row">
          {chips}
        </div>
      )
      chips = []
    }
  }
  for (const p of parts) {
    if (p.t === 'tool') {
      chips.push(
        <span key={k++} className="tool-chip">
          ⛭ {p.name}
        </span>
      )
    } else {
      flush()
      out.push(
        <div key={k++} className={`msg-text ${p.err ? 'err' : ''}`}>
          {p.err ? p.text : inline(p.text)}
        </div>
      )
    }
  }
  flush()
  return out
}

export default function Chat() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [files, setFiles] = useState([])
  const [thinking, setThinking] = useState(false)
  const [dragging, setDragging] = useState(false)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const dragDepth = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, thinking])

  useEffect(() => {
    const ta = inputRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 244)}px`
  }, [input])

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

  const onDrop = (e) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const dropped = [...e.dataTransfer.files].map((f) => ({
      name: f.name,
      size: formatSize(f.size),
    }))
    if (dropped.length) setFiles((prev) => [...prev, ...dropped])
  }

  const onDragEnter = (e) => {
    if (![...e.dataTransfer.types].includes('Files')) return
    e.preventDefault()
    dragDepth.current += 1
    setDragging(true)
  }

  const onDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragging(false)
  }

  return (
    <>
      <PageHead title="Chat // agent link">
        <span>
          agent: <span className="c">{thinking ? 'active' : 'idle'}</span>
        </span>
        <span>
          session <b>{sessionTag}</b>
        </span>
      </PageHead>

      <div
        className="chat-layout"
        onDragEnter={onDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="chat-scroll" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="chat-empty">
              <span className="tag">Link ready</span>
              <span>// no transmissions - type a directive below</span>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`msg-row ${m.from}`}>
              <div className="msg">
                <div className="msg-in">
                  <span className="msg-label">{m.from === 'user' ? 'You' : 'AutoCal'}</span>
                  {m.file && (
                    <span className="file-chip">
                      ▤ {m.file.name} // {m.file.size}
                    </span>
                  )}
                  {m.parts ? renderParts(m.parts) : m.text && <div className="msg-text">{m.text}</div>}
                </div>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="thinking">
              <span className="tag bright">Processing</span>
              <SegBar pulse count={14} />
            </div>
          )}
        </div>

        <div className="panel-frame composer-frame">
          <div className="panel-body composer">
            {files.length > 0 && (
              <div className="attach-row">
                {files.map((f, i) => (
                  <span key={i} className="file-chip">
                    ▤ {f.name} // {f.size}
                    <button onClick={() => setFiles(files.filter((_, j) => j !== i))}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <div className="composer-main">
              <textarea
                ref={inputRef}
                value={input}
                placeholder="Type a directive..."
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              <HButton primary onClick={send} disabled={thinking}>
                Send
              </HButton>
            </div>
            <span className="micro">
              <span>enter to send</span>
              <span>shift+enter newline</span>
              <span>drop a file to import</span>
            </span>
          </div>
        </div>

        {dragging && (
          <div className="drop-overlay">
            <Corners />
            <span className="big">DROP TO IMPORT</span>
            <span className="tag warn">/// any file — the agent will parse it ///</span>
          </div>
        )}
      </div>
    </>
  )
}
