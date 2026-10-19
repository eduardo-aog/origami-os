export interface ParsedCommand {
  name: string
  args: string[]
  redirect: { mode: '>' | '>>'; target: string } | null
}

export type ParseResult = { ok: true; command: ParsedCommand | null } | { ok: false; error: string }

interface Token {
  value: string
  operator: boolean
}

/**
 * Divide una línea en palabras: respeta comillas simples y dobles y la barra invertida, y reconoce
 * `>` y `>>` (sin comillas) como redirección de la salida.
 */
export function parseLine(input: string): ParseResult {
  const tokens: Token[] = []
  let current = ''
  let started = false
  let i = 0

  const flush = () => {
    if (started) tokens.push({ value: current, operator: false })
    current = ''
    started = false
  }

  while (i < input.length) {
    const char = input.charAt(i)
    if (char === ' ' || char === '\t') {
      flush()
      i += 1
    } else if (char === '>') {
      flush()
      const append = input.charAt(i + 1) === '>'
      tokens.push({ value: append ? '>>' : '>', operator: true })
      i += append ? 2 : 1
    } else if (char === "'") {
      const end = input.indexOf("'", i + 1)
      if (end === -1) return { ok: false, error: 'comillas simples sin cerrar' }
      current += input.slice(i + 1, end)
      started = true
      i = end + 1
    } else if (char === '"') {
      started = true
      i += 1
      let closed = false
      while (i < input.length) {
        const inner = input.charAt(i)
        const next = input.charAt(i + 1)
        if (inner === '\\' && (next === '"' || next === '\\')) {
          current += next
          i += 2
        } else if (inner === '"') {
          closed = true
          i += 1
          break
        } else {
          current += inner
          i += 1
        }
      }
      if (!closed) return { ok: false, error: 'comillas dobles sin cerrar' }
    } else if (char === '\\' && i + 1 < input.length) {
      current += input.charAt(i + 1)
      started = true
      i += 2
    } else {
      current += char
      started = true
      i += 1
    }
  }
  flush()

  const words: string[] = []
  let redirect: ParsedCommand['redirect'] = null
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    if (!token) continue
    if (!token.operator) {
      words.push(token.value)
      continue
    }
    const target = tokens[index + 1]
    if (!target || target.operator) {
      return { ok: false, error: `error de sintaxis cerca de '${token.value}'` }
    }
    redirect = { mode: token.value === '>>' ? '>>' : '>', target: target.value }
    index += 1
  }

  const [name, ...args] = words
  if (name === undefined) {
    return redirect ? { ok: false, error: 'falta la orden antes de la redirección' } : { ok: true, command: null }
  }
  return { ok: true, command: { name, args, redirect } }
}

/** Escapa lo que el analizador interpretaría de otra forma (espacios, comillas, barra invertida y `>`). */
export function escapeWord(text: string): string {
  return text.replace(/([ \t'"\\>])/g, '\\$1')
}

/** Quita las barras invertidas de una palabra escrita a medias. */
export function unescapeWord(text: string): string {
  return text.replace(/\\(.)/g, '$1')
}
