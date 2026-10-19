/** Subconjunto de Markdown para la Ayuda: títulos, párrafos, listas, negritas, cursivas y código en línea. */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; value: string }

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }

const HEADING = /^(#{1,3})\s+(.*)$/
const BULLET = /^[-*]\s+(.*)$/
const NUMBERED = /^\d+[.)]\s+(.*)$/

/** Índice del cierre `marker` que empieza después de `from`, o -1. Ignora los escapados con `\`. */
function findClosing(text: string, marker: string, from: number): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === '\\') {
      i++
      continue
    }
    if (text.startsWith(marker, i) && i > from) return i
  }
  return -1
}

export function parseInline(text: string): Inline[] {
  const result: Inline[] = []
  let buffer = ''
  const flush = () => {
    if (buffer) result.push({ type: 'text', value: buffer })
    buffer = ''
  }

  let i = 0
  while (i < text.length) {
    const char = text[i] as string
    if (char === '\\' && i + 1 < text.length) {
      buffer += text[i + 1]
      i += 2
      continue
    }
    if (char === '`') {
      const end = text.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        result.push({ type: 'code', value: text.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    if (text.startsWith('**', i)) {
      const end = findClosing(text, '**', i + 2)
      if (end > i + 2) {
        flush()
        result.push({ type: 'strong', children: parseInline(text.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }
    if (char === '*' || (char === '_' && !/\w/.test(text[i - 1] ?? ' '))) {
      const end = findClosing(text, char, i + 1)
      const closes =
        end > i + 1 &&
        !/\s/.test(text[i + 1] as string) &&
        !/\s/.test(text[end - 1] as string) &&
        (char === '*' || !/\w/.test(text[end + 1] ?? ' '))
      if (closes) {
        flush()
        result.push({ type: 'em', children: parseInline(text.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }
    buffer += char
    i++
  }
  flush()
  return result
}

export function parseMarkdown(source: string): Block[] {
  const blocks: Block[] = []
  let paragraph: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: 'paragraph', children: parseInline(paragraph.join(' ')) })
    paragraph = []
  }
  const flushList = () => {
    if (list) blocks.push({ type: 'list', ordered: list.ordered, items: list.items.map(parseInline) })
    list = null
  }

  for (const rawLine of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    if (trimmed === '') {
      flushParagraph()
      flushList()
      continue
    }

    const heading = HEADING.exec(trimmed)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push({
        type: 'heading',
        level: (heading[1] as string).length as 1 | 2 | 3,
        children: parseInline((heading[2] as string).trim())
      })
      continue
    }

    const bullet = BULLET.exec(trimmed)
    const numbered = bullet ? null : NUMBERED.exec(trimmed)
    const item = bullet ?? numbered
    if (item) {
      flushParagraph()
      const ordered = numbered !== null
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push((item[1] as string).trim())
      continue
    }

    // Una línea con sangría dentro de una lista continúa el elemento anterior.
    if (list && /^\s/.test(line)) {
      list.items[list.items.length - 1] += ` ${trimmed}`
      continue
    }

    flushList()
    paragraph.push(trimmed)
  }
  flushParagraph()
  flushList()
  return blocks
}

export function inlineText(inlines: Inline[]): string {
  return inlines.map((inline) => ('children' in inline ? inlineText(inline.children) : inline.value)).join('')
}

/** Texto sin formato del documento, para buscar en él. */
export function blocksText(blocks: Block[]): string {
  return blocks
    .map((block) => (block.type === 'list' ? block.items.map(inlineText).join(' ') : inlineText(block.children)))
    .join(' ')
}
