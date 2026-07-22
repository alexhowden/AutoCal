import { useEffect, useRef, useState } from 'react'
import { NodePanel, PageHead, HButton } from '../components/ui.jsx'

const seedNotes = [
  {
    id: 1,
    meta: 'today 18:12',
    lines: [
      '# fall planning',
      '',
      '## courses',
      '- [x] ECE 2300 // digital logic',
      '- [ ] CS 4820 // algorithms',
      '- [ ] swap discussion section',
      '',
      '## goals',
      'keep **gpa** above *3.7* and actually sleep',
      '> register before jul 30 or pay the late fee',
      '---',
      'drop the syllabus into `chat` and let the agent extract the deadlines',
    ],
  },
  {
    id: 2,
    meta: 'yesterday',
    lines: [
      '# project ideas',
      '- autocal syllabus import',
      '- tray quick add with natural language',
      '- weekly load report, *auto-generated*',
    ],
  },
  {
    id: 3,
    meta: 'jul 18',
    lines: ['# quick capture', 'ask prof chen about the regrade window', 'gym after 20:00 tue/thu'],
  },
]

function inline(text) {
  const re = /(`[^`]+`)|(\*\*[^*]+?\*\*)|(\*[^*]+?\*)/g
  const out = []
  let last = 0
  let m
  let k = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1]) out.push(<code key={k++}>{m[1].slice(1, -1)}</code>)
    else if (m[2]) out.push(<b key={k++}>{m[2].slice(2, -2)}</b>)
    else out.push(<em key={k++}>{m[3].slice(1, -1)}</em>)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function parseLine(text) {
  let m
  if ((m = text.match(/^#\s+(.*)$/))) return { cls: 'h1', el: inline(m[1]) }
  if ((m = text.match(/^##\s+(.*)$/))) return { cls: 'h2', el: inline(m[1]) }
  if ((m = text.match(/^###\s+(.*)$/))) return { cls: 'h3', el: inline(m[1]) }
  if (/^-{3,}\s*$/.test(text)) return { cls: 'rule', el: <i className="nhr" /> }
  if ((m = text.match(/^- \[([ xX])\]\s?(.*)$/))) {
    const done = m[1] !== ' '
    return {
      cls: 'task',
      el: (
        <>
          <span className={`checkbox ${done ? 'checked' : ''}`}>{done ? '✕' : ''}</span>
          <span className={done ? 'ndone' : ''}>{inline(m[2])}</span>
        </>
      ),
    }
  }
  if ((m = text.match(/^-\s+(.*)$/)))
    return {
      cls: 'li',
      el: (
        <>
          <span className="nbul">▪</span>
          {inline(m[1])}
        </>
      ),
    }
  if ((m = text.match(/^>\s?(.*)$/))) return { cls: 'quote', el: inline(m[1]) }
  if (/^\s*$/.test(text)) return { cls: '', el: ' ' }
  return { cls: '', el: inline(text) }
}

const noteTitle = (note) => {
  const first = note.lines.find((l) => l.trim() !== '')
  if (!first) return 'untitled'
  return (
    first
      .replace(/^#+\s*/, '')
      .replace(/^- \[.\]\s*/, '')
      .replace(/^[->]\s*/, '')
      .replace(/[*`]/g, '')
      .trim() || 'untitled'
  )
}

export default function Notes() {
  const [notes, setNotes] = useState(seedNotes)
  const [activeId, setActiveId] = useState(1)
  const [lineIdx, setLineIdx] = useState(null)
  const caretRef = useRef(0)
  const inputRef = useRef(null)

  const note = notes.find((n) => n.id === activeId)
  const lines = note ? note.lines : []

  useEffect(() => {
    if (lineIdx === null || !inputRef.current) return
    const el = inputRef.current
    el.focus()
    const c = Math.min(caretRef.current, el.value.length)
    el.setSelectionRange(c, c)
  }, [lineIdx, activeId])

  const setLines = (fn) =>
    setNotes((ns) => ns.map((n) => (n.id === activeId ? { ...n, lines: fn(n.lines), meta: 'just now' } : n)))

  const activate = (i, caret) => {
    caretRef.current = caret
    setLineIdx(i)
  }

  const onKeyDown = (e, i) => {
    const el = e.target
    if (e.key === 'Enter') {
      e.preventDefault()
      const at = el.selectionStart
      setLines((ls) => [...ls.slice(0, i), ls[i].slice(0, at), ls[i].slice(at), ...ls.slice(i + 1)])
      activate(i + 1, 0)
    } else if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0 && i > 0) {
      e.preventDefault()
      const prevLen = lines[i - 1].length
      setLines((ls) => [...ls.slice(0, i - 1), ls[i - 1] + ls[i], ...ls.slice(i + 1)])
      activate(i - 1, prevLen)
    } else if (e.key === 'ArrowUp' && i > 0) {
      e.preventDefault()
      activate(i - 1, el.selectionStart)
    } else if (e.key === 'ArrowDown' && i < lines.length - 1) {
      e.preventDefault()
      activate(i + 1, el.selectionStart)
    } else if (e.key === 'Escape') {
      setLineIdx(null)
    }
  }

  const selectNote = (id) => {
    setActiveId(id)
    setLineIdx(null)
  }

  const newNote = () => {
    const id = Math.max(0, ...notes.map((n) => n.id)) + 1
    setNotes((ns) => [{ id, meta: 'just now', lines: ['# untitled', ''] }, ...ns])
    setActiveId(id)
    activate(1, 0)
  }

  const deleteNote = (e, id) => {
    e.stopPropagation()
    const rest = notes.filter((n) => n.id !== id)
    setNotes(rest)
    if (id === activeId) {
      setActiveId(rest.length ? rest[0].id : null)
      setLineIdx(null)
    }
  }

  return (
    <>
      <PageHead title="Notes // scratch memory">
        <span>{notes.length} saved</span>
        <span>
          markdown <b>live render</b>
        </span>
      </PageHead>

      <div className="notes-layout">
        <NodePanel title="Saved" right={String(notes.length).padStart(2, '0')} className="notes-side">
          <div className="note-list">
            {notes.map((n) => (
              <div
                key={n.id}
                className={`note-row ${n.id === activeId ? 'active' : ''}`}
                onClick={() => selectNote(n.id)}
              >
                <span className="note-row-title">{noteTitle(n)}</span>
                <span className="note-row-meta">{n.meta}</span>
                <button className="note-x" onClick={(e) => deleteNote(e, n.id)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <HButton small onClick={newNote}>
            New note
          </HButton>
        </NodePanel>

        <NodePanel
          title={note ? noteTitle(note) : 'no note'}
          right={note ? `${lines.length} lines` : ''}
          className="notes-main"
        >
          {note ? (
            <div
              className="note-editor"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) {
                  e.preventDefault()
                  activate(lines.length - 1, lines[lines.length - 1].length)
                }
              }}
            >
              {lines.map((text, i) =>
                i === lineIdx ? (
                  <input
                    key={i}
                    ref={inputRef}
                    className="note-input"
                    value={text}
                    onChange={(e) => setLines((ls) => ls.map((l, j) => (j === i ? e.target.value : l)))}
                    onKeyDown={(e) => onKeyDown(e, i)}
                    onBlur={() => setLineIdx(null)}
                    spellCheck={false}
                  />
                ) : (
                  (({ cls, el }) => (
                    <div
                      key={i}
                      className={`note-line ${cls}`}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        activate(i, text.length)
                      }}
                    >
                      {el}
                    </div>
                  ))(parseLine(text))
                )
              )}
            </div>
          ) : (
            <div className="micro" style={{ padding: 12 }}>
              no notes - create one
            </div>
          )}
        </NodePanel>
      </div>
    </>
  )
}
