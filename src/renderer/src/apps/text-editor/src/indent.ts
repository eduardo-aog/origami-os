/** Sangría del Editor: lógica pura sobre el texto, sin tocar el DOM. */

export const INDENT = '    '
const WIDTH = INDENT.length

/** Reemplaza `[from, to)` por `insert` y deja seleccionado `[selStart, selEnd)` del texto resultante. */
export interface Edit {
  from: number
  to: number
  insert: string
  selStart: number
  selEnd: number
}

const lineStartOf = (text: string, index: number) => text.lastIndexOf('\n', index - 1) + 1

/**
 * `Tab` y `Mayús+Tab`. Sin selección (o con una dentro de una línea) `Tab` avanza hasta el siguiente
 * múltiplo de 4 columnas; con varias líneas, o con `Mayús`, mueve la sangría de cada línea tocada.
 */
export function tabEdit(text: string, start: number, end: number, outdent: boolean): Edit {
  const multiline = text.slice(start, end).includes('\n')
  if (!outdent && !multiline) {
    const spaces = ' '.repeat(WIDTH - ((start - lineStartOf(text, start)) % WIDTH))
    return { from: start, to: end, insert: spaces, selStart: start + spaces.length, selEnd: start + spaces.length }
  }

  const blockStart = lineStartOf(text, start)
  // Una selección que termina justo después de un salto de línea no incluye la línea siguiente.
  const lastIndex = end > start && text[end - 1] === '\n' ? end - 1 : end
  const newline = text.indexOf('\n', lastIndex)
  const blockEnd = newline === -1 ? text.length : newline
  const lines = text.slice(blockStart, blockEnd).split('\n')

  const deltas: number[] = []
  const changed = lines.map((line) => {
    if (!outdent) {
      deltas.push(line === '' ? 0 : WIDTH)
      return line === '' ? line : INDENT + line
    }
    const removed = line.startsWith('\t') ? 1 : (/^ */.exec(line)?.[0].length ?? 0)
    const count = line.startsWith('\t') ? 1 : Math.min(WIDTH, removed)
    deltas.push(-count)
    return line.slice(count)
  })

  const total = deltas.reduce((sum, delta) => sum + delta, 0)
  const selStart = Math.max(blockStart, start + (deltas[0] ?? 0))
  const selEnd = Math.max(selStart, end + total)
  return { from: blockStart, to: blockEnd, insert: changed.join('\n'), selStart, selEnd }
}

/**
 * `Enter` conserva la sangría de la línea; en un archivo de Python, si la línea acaba en `:`,
 * añade un nivel más.
 */
export function enterEdit(text: string, start: number, end: number, python: boolean): Edit {
  const before = text.slice(lineStartOf(text, start), start)
  let indent = /^[ \t]*/.exec(before)?.[0] ?? ''
  if (python && before.trimEnd().endsWith(':')) indent += INDENT
  const insert = `\n${indent}`
  return { from: start, to: end, insert, selStart: start + insert.length, selEnd: start + insert.length }
}

/** `Retroceso` dentro de la sangría borra hasta el nivel anterior en vez de un solo espacio. */
export function backspaceEdit(text: string, start: number, end: number): Edit | null {
  if (start !== end) return null
  const before = text.slice(lineStartOf(text, start), start)
  if (before === '' || !/^ +$/.test(before)) return null
  const remove = before.length % WIDTH || WIDTH
  return { from: start - remove, to: start, insert: '', selStart: start - remove, selEnd: start - remove }
}
