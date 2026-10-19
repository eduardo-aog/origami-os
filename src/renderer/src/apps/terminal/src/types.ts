import type { FsApi, PythonIo, PythonJob, PythonRun } from '@os/sdk'

/** Un tramo de texto de una línea de la terminal; `tone` le da color. */
export interface Segment {
  text: string
  tone?: 'dir' | 'error' | 'muted' | 'user' | 'path'
}

export type Line = Segment[]

export const plain = (text: string): Line => [{ text }]
export const failure = (text: string): Line => [{ text, tone: 'error' }]

/** Salida que se muestra mientras una orden sigue ejecutándose, y cómo cortarla con Ctrl+C. */
export interface LiveOutput {
  print: (lines: Line[]) => void
  setCancel: (cancel: (() => void) | null) => void
}

/** Lo que una orden necesita del sistema. Solo usa `fs`, `apps` y `python` del SDK, más datos de la sesión. */
export interface ShellEnv {
  fs: FsApi
  openFile: (path: string) => void
  python: (job: PythonJob, io: PythonIo) => PythonRun
  /** Salida en vivo; es `null` cuando la salida se redirige a un archivo y hay que devolverla entera. */
  live: LiveOutput | null
  user: string
  /** Ruta absoluta de la carpeta de inicio. */
  home: string
  /** Fecha y hora actuales formateadas según la configuración de fecha y hora. */
  now: () => string
  /** Órdenes escritas hasta ahora, de la más antigua a la más reciente. */
  history: () => readonly string[]
  /** Directorio actual: las órdenes `cd` lo modifican. */
  cwd: string
}

/** Resultado de ejecutar una orden: lo que va a la salida normal y lo que va a la de errores. */
export interface CommandOutput {
  out: Line[]
  err: Line[]
  clear?: boolean
}

export interface Command {
  usage: string
  description: string
  /** ¿Sus argumentos son rutas que se pueden autocompletar? */
  paths: boolean
  run: (args: string[], env: ShellEnv) => Promise<CommandOutput>
}
