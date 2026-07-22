import { useEffect, useRef, useState } from 'react'
import { NodePanel, PageHead, HButton } from '../components/ui.jsx'
import { getNotes, createNote, patchNote, deleteNoteApi } from '../api.js'
import { localDate, hm } from '../gcal.js'
import { inline } from '../md.jsx'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function metaOf(updated) {
  const d = new Date(updated)
  const today = localDate(new Date())
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (localDate(d) === today) return `today ${hm(d)}`
  if (localDate(d) === localDate(yesterday)) return 'yesterday'
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

const fromApi = (n) => ({ id: n.id, lines: n.text.split('\n'), meta: metaOf(n.updated) })

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
  const [notes, setNotes] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [linkDown, setLinkDown] = useState(false)
  const [lineIdx, setLineIdx] = useState(null)
  const caretRef = useRef(0)
  const inputRef = useRef(null)
  const dirtyRef = useRef(new Set())

  const note = notes.find((n) => n.id === activeId)
  const lines = note ? note.lines : []

  useEffect(() => {
    getNotes()
      .then((ns) => {
        setNotes(ns.map(fromApi))
        if (ns.length) setActiveId(ns[0].id)
      })
      .catch(() => setLinkDown(true))
  }, [])

  useEffect(() => {
    if (lineIdx === null || !inputRef.current) return
    const el = inputRef.current
    el.focus()
    const c = Math.min(caretRef.current, el.value.length)
    el.setSelectionRange(c, c)
  }, [lineIdx, activeId])

  // debounced autosave of any note touched since the last flush
  useEffect(() => {
    if (dirtyRef.current.size === 0) return
    const t = setTimeout(() => {
      const ids = [...dirtyRef.current]
      dirtyRef.current.clear()
      ids.forEach((id) => {
        const n = notes.find((x) => x.id === id)
        if (n) patchNote(id, n.lines.join('\n')).catch(() => setLinkDown(true))
      })
    }, 800)
    return () => clearTimeout(t)
  }, [notes])

  const setLines = (fn) => {
    dirtyRef.current.add(activeId)
    setNotes((ns) => ns.map((n) => (n.id === activeId ? { ...n, lines: fn(n.lines), meta: 'just now' } : n)))
  }

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

  const newNote = async () => {
    try {
      const n = await createNote('# untitled\n')
      setNotes((ns) => [fromApi(n), ...ns])
      setActiveId(n.id)
      activate(1, 0)
    } catch {
      setLinkDown(true)
    }
  }

  const deleteNote = (e, id) => {
    e.stopPropagation()
    dirtyRef.current.delete(id)
    const rest = notes.filter((n) => n.id !== id)
    setNotes(rest)
    if (id === activeId) {
      setActiveId(rest.length ? rest[0].id : null)
      setLineIdx(null)
    }
    deleteNoteApi(id).catch(() => setLinkDown(true))
  }

  return (
    <>
      <PageHead title="Notes // scratch memory">
        <span>{notes.length} saved</span>
        <span>
          markdown <b>live render</b>
        </span>
        {linkDown && <span className="tag warn">link offline</span>}
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
