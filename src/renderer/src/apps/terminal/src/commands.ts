import { FsError, type FsNode } from '@os/sdk'
import { baseNameOf, joinPath, parentOf, resolvePath } from './paths'
import type { PythonJob } from '@os/sdk'
import { failure, plain, type Command, type CommandOutput, type Line, type ShellEnv } from './types'

/* ───── Utilidades comunes ───── */

const REASONS: Record<string, string> = {
  ENOENT: 'No existe el fichero o el directorio',
  EEXIST: 'El fichero ya existe',
  ENOTDIR: 'No es un directorio',
  EISDIR: 'Es un directorio',
  ENOTEMPTY: 'El directorio no está vacío'
}

/** El motivo de un error, con el estilo corto de Unix. Los errores con mensaje propio lo conservan. */
export function reasonOf(error: unknown): string {
  if (error instanceof FsError) return REASONS[error.code] ?? error.message
  return error instanceof Error ? error.message : String(error)
}

class Output {
  readonly out: Line[] = []
  readonly err: Line[] = []

  print(text: string): void {
    this.out.push(plain(text))
  }

  error(text: string): void {
    this.err.push(failure(text))
  }

  result(extra: Partial<CommandOutput> = {}): CommandOutput {
    return { out: this.out, err: this.err, ...extra }
  }
}

interface ParsedArgs {
  flags: Set<string>
  operands: string[]
  /** Primera opción que la orden no admite, si hay alguna. */
  invalid: string | null
}

/** Separa opciones cortas (`-rf`) de operandos. `--` termina las opciones. */
function parseArgs(args: string[], allowed: string): ParsedArgs {
  const flags = new Set<string>()
  const operands: string[] = []
  let invalid: string | null = null
  let optionsDone = false
  for (const arg of args) {
    if (!optionsDone && arg === '--') {
      optionsDone = true
    } else if (!optionsDone && arg.length > 1 && arg.startsWith('-')) {
      for (const letter of arg.slice(1)) {
        if (allowed.includes(letter)) flags.add(letter)
        else invalid ??= letter
      }
    } else {
      operands.push(arg)
    }
  }
  return { flags, operands, invalid }
}

const absolute = (arg: string, env: ShellEnv) => resolvePath(arg, env.cwd, env.home)

async function tryStat(env: ShellEnv, path: string): Promise<FsNode | null> {
  try {
    return await env.fs.stat(path)
  } catch (error) {
    if (error instanceof FsError && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return null
    throw error
  }
}

function invalidOption(output: Output, name: string, letter: string): CommandOutput {
  output.error(`${name}: opción inválida -- '${letter}'`)
  output.error(`Pruebe 'help' para ver cómo se usa.`)
  return output.result()
}

const TEXT_MIMES = new Set(['application/json', 'application/xml', 'application/javascript', 'image/svg+xml'])
const isTextual = (node: FsNode) => node.mime.startsWith('text/') || TEXT_MIMES.has(node.mime)

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1000
  let unit = 0
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000
    unit += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return `${String(date.getDate()).padStart(2, ' ')} ${MONTHS[date.getMonth()]} ${time}`
}

/* ───── Órdenes ───── */

const ls: Command = {
  usage: 'ls [-l] [ruta…]',
  description: 'Lista el contenido de una carpeta (-l, formato largo).',
  paths: true,
  async run(args, env) {
    const output = new Output()
    const { flags, operands, invalid } = parseArgs(args, 'l')
    if (invalid !== null) return invalidOption(output, 'ls', invalid)
    const long = flags.has('l')

    const describe = (node: FsNode): Line => {
      const name = { text: node.name, ...(node.kind === 'folder' ? { tone: 'dir' as const } : {}) }
      if (!long) return [name]
      const kind = node.kind === 'folder' ? 'd' : '-'
      const size = node.kind === 'folder' ? '-' : formatSize(node.size)
      return [{ text: `${kind}  ${size.padStart(8)}  ${formatDate(node.modifiedAt)}  `, tone: 'muted' }, name]
    }

    const targets = operands.length > 0 ? operands : ['.']
    let first = true
    for (const target of targets) {
      try {
        const node = await env.fs.stat(absolute(target, env))
        if (targets.length > 1) {
          if (!first) output.print('')
          output.print(`${target}:`)
        }
        first = false
        if (node.kind === 'file') {
          output.out.push(describe(node))
          continue
        }
        const children = await env.fs.list(absolute(target, env))
        if (long) {
          for (const child of children) output.out.push(describe(child))
        } else if (children.length > 0) {
          const line: Line = []
          children.forEach((child, index) => {
            if (index > 0) line.push({ text: '  ' })
            line.push(...describe(child))
          })
          output.out.push(line)
        }
      } catch (error) {
        output.error(`ls: no se puede acceder a '${target}': ${reasonOf(error)}`)
      }
    }
    return output.result()
  }
}

const cd: Command = {
  usage: 'cd [ruta]',
  description: 'Cambia de carpeta. Sin argumentos vuelve a la carpeta de inicio.',
  paths: true,
  async run(args, env) {
    const output = new Output()
    if (args.length > 1) {
      output.error('cd: demasiados argumentos')
      return output.result()
    }
    const target = args[0] ?? '~'
    try {
      const node = await env.fs.stat(absolute(target, env))
      if (node.kind !== 'folder') {
        output.error(`cd: ${target}: No es un directorio`)
      } else {
        env.cwd = await env.fs.pathOf(node.id)
      }
    } catch (error) {
      output.error(`cd: ${target}: ${reasonOf(error)}`)
    }
    return output.result()
  }
}

const pwd: Command = {
  usage: 'pwd',
  description: 'Muestra la ruta de la carpeta actual.',
  paths: false,
  async run(_args, env) {
    const output = new Output()
    output.print(env.cwd)
    return output.result()
  }
}

const mkdir: Command = {
  usage: 'mkdir [-p] carpeta…',
  description: 'Crea carpetas (-p, también las intermedias).',
  paths: true,
  async run(args, env) {
    const output = new Output()
    const { flags, operands, invalid } = parseArgs(args, 'p')
    if (invalid !== null) return invalidOption(output, 'mkdir', invalid)
    if (operands.length === 0) {
      output.error('mkdir: falta un operando')
      return output.result()
    }
    for (const target of operands) {
      try {
        await env.fs.mkdir(absolute(target, env), { recursive: flags.has('p') })
      } catch (error) {
        output.error(`mkdir: no se puede crear el directorio '${target}': ${reasonOf(error)}`)
      }
    }
    return output.result()
  }
}

const touch: Command = {
  usage: 'touch archivo…',
  description: 'Crea archivos vacíos o actualiza la fecha de los que ya existen.',
  paths: true,
  async run(args, env) {
    const output = new Output()
    if (args.length === 0) {
      output.error('touch: falta un operando')
      return output.result()
    }
    for (const target of args) {
      try {
        const path = absolute(target, env)
        const existing = await tryStat(env, path)
        if (existing === null) await env.fs.writeFile(path, '')
        else if (existing.kind === 'file') await env.fs.writeFile(path, await env.fs.readFile(path), { overwrite: true })
      } catch (error) {
        output.error(`touch: no se puede crear '${target}': ${reasonOf(error)}`)
      }
    }
    return output.result()
  }
}

const cat: Command = {
  usage: 'cat archivo…',
  description: 'Muestra el contenido de archivos de texto.',
  paths: true,
  async run(args, env) {
    const output = new Output()
    if (args.length === 0) {
      output.error('cat: falta un operando')
      return output.result()
    }
    for (const target of args) {
      try {
        const path = absolute(target, env)
        const node = await env.fs.stat(path)
        if (node.kind === 'folder') throw new FsError('EISDIR', `"${node.name}" es una carpeta.`)
        if (!isTextual(node)) {
          output.error(`cat: ${target}: Es un archivo binario`)
          continue
        }
        const text = await env.fs.readText(path)
        if (text === '') continue
        const lines = text.split('\n')
        if (lines[lines.length - 1] === '') lines.pop()
        for (const line of lines) output.print(line)
      } catch (error) {
        output.error(`cat: ${target}: ${reasonOf(error)}`)
      }
    }
    return output.result()
  }
}

const echo: Command = {
  usage: 'echo [texto…] [> archivo | >> archivo]',
  description: 'Imprime texto. Con > lo escribe en un archivo y con >> lo añade al final.',
  paths: false,
  async run(args) {
    const output = new Output()
    output.print(args.join(' '))
    return output.result()
  }
}

const rm: Command = {
  usage: 'rm [-r] ruta…',
  description: 'Envía archivos o carpetas (-r) a la papelera.',
  paths: true,
  async run(args, env) {
    const output = new Output()
    const { flags, operands, invalid } = parseArgs(args, 'rRf')
    if (invalid !== null) return invalidOption(output, 'rm', invalid)
    if (operands.length === 0) {
      output.error('rm: falta un operando')
      return output.result()
    }
    const recursive = flags.has('r') || flags.has('R')
    for (const target of operands) {
      try {
        const path = absolute(target, env)
        const node = await tryStat(env, path)
        if (node === null) {
          if (!flags.has('f')) output.error(`rm: no se puede borrar '${target}': No existe el fichero o el directorio`)
          continue
        }
        if (node.kind === 'folder' && !recursive) {
          output.error(`rm: no se puede borrar '${target}': Es un directorio`)
          continue
        }
        await env.fs.trash(path)
      } catch (error) {
        output.error(`rm: no se puede borrar '${target}': ${reasonOf(error)}`)
      }
    }
    return output.result()
  }
}

/** `mv` y `cp` comparten casi todo: cómo resolver el destino y qué hacer si es un nombre nuevo. */
function transferCommand(kind: 'mv' | 'cp'): Command {
  const moving = kind === 'mv'
  return {
    usage: moving ? 'mv origen… destino' : 'cp [-r] origen… destino',
    description: moving
      ? 'Mueve o renombra archivos y carpetas.'
      : 'Copia archivos y carpetas (-r, carpetas completas).',
    paths: true,
    async run(args, env) {
      const output = new Output()
      const { flags, operands, invalid } = parseArgs(args, moving ? '' : 'rR')
      if (invalid !== null) return invalidOption(output, kind, invalid)
      const recursive = flags.has('r') || flags.has('R')
      if (operands.length < 2) {
        output.error(operands.length === 0 ? `${kind}: falta un operando` : `${kind}: falta el operando de destino tras '${operands[0]}'`)
        return output.result()
      }
      const destArg = operands[operands.length - 1] ?? ''
      const sources = operands.slice(0, -1)
      const destPath = absolute(destArg, env)

      try {
        const destNode = await tryStat(env, destPath)
        const intoFolder = destNode?.kind === 'folder'
        if (sources.length > 1 && !intoFolder) {
          output.error(`${kind}: el objetivo '${destArg}' no es un directorio`)
          return output.result()
        }
        const newName = baseNameOf(destPath)
        const destParent = intoFolder ? destPath : parentOf(destPath)
        if (!intoFolder) {
          if (destNode !== null) {
            output.error(`${kind}: no se puede sobrescribir '${destArg}': El fichero ya existe`)
            return output.result()
          }
          const parent = await tryStat(env, destParent)
          if (parent === null || parent.kind !== 'folder') {
            output.error(`${kind}: no se puede crear '${destArg}': ${parent === null ? 'No existe el fichero o el directorio' : 'No es un directorio'}`)
            return output.result()
          }
        }

        for (const source of sources) {
          try {
            const sourcePath = absolute(source, env)
            const node = await env.fs.stat(sourcePath)
            if (!moving && node.kind === 'folder' && !recursive) {
              output.error(`cp: -r no especificado; se omite el directorio '${source}'`)
              continue
            }
            if (moving && !intoFolder && parentOf(sourcePath) === destParent) {
              await env.fs.rename(sourcePath, newName)
              continue
            }
            const result = await (moving ? env.fs.move(sourcePath, destParent) : env.fs.copy(sourcePath, destParent))
            if (!intoFolder && result.name !== newName) await env.fs.rename(joinPath(destParent, result.name), newName)
          } catch (error) {
            output.error(`${kind}: no se puede ${moving ? 'mover' : 'copiar'} '${source}': ${reasonOf(error)}`)
          }
        }
      } catch (error) {
        output.error(`${kind}: '${destArg}': ${reasonOf(error)}`)
      }
      return output.result()
    }
  }
}

const tree: Command = {
  usage: 'tree [ruta]',
  description: 'Muestra el árbol de carpetas y archivos.',
  paths: true,
  async run(args, env) {
    const output = new Output()
    if (args.length > 1) {
      output.error('tree: demasiados argumentos')
      return output.result()
    }
    const target = args[0] ?? '.'
    const counts = { folders: 0, files: 0 }

    async function walk(path: string, prefix: string): Promise<void> {
      const children = await env.fs.list(path)
      for (const [index, child] of children.entries()) {
        const last = index === children.length - 1
        output.out.push([
          { text: `${prefix}${last ? '└── ' : '├── '}`, tone: 'muted' },
          { text: child.name, ...(child.kind === 'folder' ? { tone: 'dir' as const } : {}) }
        ])
        if (child.kind === 'folder') {
          counts.folders += 1
          await walk(joinPath(path, child.name), `${prefix}${last ? '    ' : '│   '}`)
        } else {
          counts.files += 1
        }
      }
    }

    try {
      const path = absolute(target, env)
      const node = await env.fs.stat(path)
      output.out.push([{ text: target, tone: 'dir' }])
      if (node.kind === 'folder') await walk(path, '')
      output.print('')
      output.print(`${counts.folders} ${counts.folders === 1 ? 'directorio' : 'directorios'}, ${counts.files} ${counts.files === 1 ? 'archivo' : 'archivos'}`)
    } catch (error) {
      output.error(`tree: ${target}: ${reasonOf(error)}`)
    }
    return output.result()
  }
}

const open: Command = {
  usage: 'open ruta…',
  description: 'Abre archivos con su aplicación predeterminada y carpetas en el explorador de archivos.',
  paths: true,
  async run(args, env) {
    const output = new Output()
    if (args.length === 0) {
      output.error('open: falta un operando')
      return output.result()
    }
    for (const target of args) {
      try {
        const path = absolute(target, env)
        await env.fs.stat(path)
        env.openFile(path)
      } catch (error) {
        output.error(`open: ${target}: ${reasonOf(error)}`)
      }
    }
    return output.result()
  }
}

const date: Command = {
  usage: 'date',
  description: 'Muestra la fecha y la hora actuales.',
  paths: false,
  async run(_args, env) {
    const output = new Output()
    output.print(env.now())
    return output.result()
  }
}

const whoami: Command = {
  usage: 'whoami',
  description: 'Muestra el nombre del usuario.',
  paths: false,
  async run(_args, env) {
    const output = new Output()
    output.print(env.user)
    return output.result()
  }
}

const clear: Command = {
  usage: 'clear',
  description: 'Limpia la pantalla.',
  paths: false,
  async run() {
    return new Output().result({ clear: true })
  }
}

const history: Command = {
  usage: 'history',
  description: 'Muestra las órdenes escritas.',
  paths: false,
  async run(_args, env) {
    const output = new Output()
    env.history().forEach((entry, index) => output.print(`${String(index + 1).padStart(4)}  ${entry}`))
    return output.result()
  }
}

/** Ejecuta un programa de Python y muestra su salida a medida que llega. */
async function runPython(job: PythonJob, env: ShellEnv, output: Output): Promise<CommandOutput> {
  const { live } = env
  const emit = (isError: boolean) => (text: string) => {
    const line = isError ? failure(text) : plain(text)
    if (live) live.print([line])
    else (isError ? output.err : output.out).push(line)
  }
  let run
  try {
    run = env.python(job, {
      onStdout: emit(false),
      onStderr: emit(true),
      onLoading: () => live?.print([[{ text: 'Cargando Python…', tone: 'muted' }]])
    })
  } catch (error) {
    output.error(`python: ${reasonOf(error)}`)
    return output.result()
  }
  live?.setCancel(run.cancel)
  try {
    await run.result
  } catch (error) {
    output.error(`python: ${reasonOf(error)}`)
  } finally {
    live?.setCancel(null)
  }
  return output.result()
}

const python: Command = {
  usage: 'python archivo.py [argumentos…] | python -c "código" (también python3)',
  description: 'Ejecuta un programa de Python (solo biblioteca estándar, sin entrada interactiva). Ctrl+C lo corta.',
  paths: true,
  async run(args, env) {
    const output = new Output()
    const [first, ...rest] = args
    if (first === undefined) {
      output.error('python: falta un archivo o la opción -c')
      return output.result()
    }
    if (first === '--version' || first === '-V') {
      return runPython({ code: "import sys\nprint('Python', sys.version.split()[0])" }, env, output)
    }
    if (first === '-c') {
      const [code, ...extra] = rest
      if (code === undefined) {
        output.error('python: la opción -c necesita un código')
        return output.result()
      }
      return runPython({ code, args: extra }, env, output)
    }
    try {
      const code = await env.fs.readText(absolute(first, env))
      return await runPython({ code, filename: first, args: rest }, env, output)
    } catch (error) {
      output.error(`python: ${first}: ${reasonOf(error)}`)
      return output.result()
    }
  }
}

const help: Command = {
  usage: 'help',
  description: 'Muestra esta lista de órdenes.',
  paths: false,
  async run() {
    const output = new Output()
    output.print('Órdenes disponibles:')
    output.print('')
    for (const command of new Set(Object.values(COMMANDS))) {
      output.out.push([{ text: `  ${command.usage}`, tone: 'path' }])
      output.print(`      ${command.description}`)
    }
    output.print('')
    output.print('Tab autocompleta rutas y órdenes; las flechas arriba y abajo recorren el historial.')
    return output.result()
  }
}

export const COMMANDS: Record<string, Command> = {
  help,
  python,
  python3: python,
  ls,
  cd,
  pwd,
  mkdir,
  touch,
  cat,
  echo,
  rm,
  mv: transferCommand('mv'),
  cp: transferCommand('cp'),
  tree,
  open,
  date,
  whoami,
  clear,
  history
}
