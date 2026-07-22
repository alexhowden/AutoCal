// inline markdown: `code`, **bold**, *italic* -> React elements
export function inline(text) {
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
