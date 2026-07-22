import { useEffect, useRef, useState } from 'react'
import { Panel, SegBar, PageHead, Corners, HButton } from '../components/ui.jsx'
import { seedMessages } from '../mock.js'

function formatSize(bytes) {
  if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export default function Chat() {
  const [messages, setMessages] = useState(seedMessages)
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

  const send = () => {
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
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: Date.now() + 1,
          from: 'agent',
          text: '// LINK OFFLINE — this is a UI preview. The agent backend gets wired up next.',
        },
      ])
      setThinking(false)
    }, 1600)
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
          agent: <span className="c">idle</span>
        </span>
        <span>
          session <b>a3f7</b>
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
                  {m.text && <div>{m.text}</div>}
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
