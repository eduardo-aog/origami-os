import { COMMANDS, reasonOf } from './commands'
import { escapeWord, parseLine, unescapeWord } from './parser'
import { resolvePath } from './paths'
import { failure, type CommandOutput, type ShellEnv } from './types'

/** Interpreta y ejecuta una línea. Las órdenes `cd` modifican `env.cwd`. */
export async function execute(input: string, env: ShellEnv): Promise<CommandOutput> {
  const parsed = parseLine(input)
  if (!parsed.ok) return { out: [], err: [failure(`shell: ${parsed.error}`)] }
  if (parsed.command === null) return { out: [], err: [] }

  const { name, args, redirect } = parsed.command
  const command = Object.hasOwn(COMMANDS, name) ? COMMANDS[name] : undefined
  if (!command) return { out: [], err: [failure(`${name}: orden no encontrada`)] }

  // Con redirección la salida no se muestra en vivo: se junta entera para escribirla en el archivo.
  const live = env.live
  if (redirect) env.live = null
  let result: CommandOutput
  try {
    result = await command.run(args, env)
  } finally {
    env.live = live
  }
  if (!redirect) return result

  // Con redirección, la salida normal va al archivo y los errores se siguen mostrando.
  const text = result.out.map((line) => line.map((segment) => segment.text).join('')).join('\n')
  const path = resolvePath(redirect.target, env.cwd, env.home)
  try {
    let content = text === '' ? '' : `${text}\n`
    if (redirect.mode === '>>' && (await env.fs.exists(path))) {
      const previous = await env.fs.readText(path)
      content = `${previous}${previous === '' || previous.endsWith('\n') ? '' : '\n'}${content}`
    }
    await env.fs.writeFile(path, content, { overwrite: true })
    return { ...result, out: [] }
  } catch (error) {
    return { ...result, out: [], err: [...result.err, failure(`${name}: ${redirect.target}: ${reasonOf(error)}`)] }
  }
}

export interface Completion {
  /** Nueva línea de entrada. */
  text: string
  /** Si no se pudo avanzar y hay varias opciones, se muestran. */
  options: string[]
}

/** Autocompleta la última palabra de la línea: órdenes en la primera posición y rutas en las demás. */
export async function complete(input: string, env: ShellEnv): Promise<Completion | null> {
  let start = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charAt(i)
    if (char === '\\') i += 1
    else if (char === ' ' || char === '\t' || char === '>') start = i + 1
  }
  const prefix = input.slice(0, start)
  const raw = unescapeWord(input.slice(start))
  const firstWord = prefix.trim() === ''

  if (firstWord && !raw.includes('/')) {
    const names = Object.keys(COMMANDS).filter((name) => name.startsWith(raw))
    return finish(prefix, '', raw, names.map((name) => ({ name, folder: false })), false)
  }

  const slash = raw.lastIndexOf('/')
  const directory = raw.slice(0, slash + 1)
  const partial = raw.slice(slash + 1)
  try {
    const children = await env.fs.list(resolvePath(directory === '' ? '.' : directory, env.cwd, env.home))
    const matches = children
      .filter((child) => child.name.startsWith(partial))
      .map((child) => ({ name: child.name, folder: child.kind === 'folder' }))
    return finish(prefix, directory, partial, matches, true)
  } catch {
    return null
  }
}

function finish(
  prefix: string,
  directory: string,
  partial: string,
  matches: { name: string; folder: boolean }[],
  isPath: boolean
): Completion | null {
  const only = matches.length === 1 ? matches[0] : undefined
  if (only) {
    const ending = only.folder && isPath ? '/' : ' '
    return { text: `${prefix}${escapeWord(directory + only.name)}${ending}`, options: [] }
  }
  if (matches.length === 0) return null

  let common = matches[0]?.name ?? ''
  for (const { name } of matches) {
    while (!name.startsWith(common)) common = common.slice(0, -1)
  }
  if (common.length > partial.length) {
    return { text: `${prefix}${escapeWord(directory + common)}`, options: [] }
  }
  return { text: `${prefix}${escapeWord(directory + partial)}`, options: matches.map((match) => (match.folder ? `${match.name}/` : match.name)) }
}
