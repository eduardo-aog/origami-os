import type { AppContext } from '../apps'
import { on } from '../events'
import type { FromWorker, ToWorker } from './protocol'

export interface PythonJob {
  code: string
  /** Archivo que se ejecuta (para `__file__`, `sys.argv` y los mensajes de error); sin él, el código es de `-c`. */
  filename?: string
  /** Argumentos que ve el programa en `sys.argv[1:]`. */
  args?: string[]
}

export interface PythonIo {
  onStdout(text: string): void
  onStderr(text: string): void
  /** Se llama una vez si hay que cargar Pyodide antes de ejecutar (la primera vez tarda unos segundos). */
  onLoading?(): void
}

export interface PythonResult {
  exitCode: number
  cancelled: boolean
}

export interface PythonRun {
  result: Promise<PythonResult>
  cancel(): void
}

interface ActiveRun {
  id: number
  instanceId: string
  io: PythonIo
  resolve(result: PythonResult): void
  reject(error: Error): void
}

const CANCELLED_EXIT_CODE = 130

let worker: Worker | null = null
let active: ActiveRun | null = null
let nextId = 1
let initialized = false

function handleMessage(message: FromWorker): void {
  if (!active || active.id !== message.id) return
  const run = active
  switch (message.type) {
    case 'loading':
      run.io.onLoading?.()
      break
    case 'stdout':
      run.io.onStdout(message.text)
      break
    case 'stderr':
      run.io.onStderr(message.text)
      break
    case 'done':
      active = null
      run.resolve({ exitCode: message.exitCode, cancelled: false })
      break
    case 'failed':
      // Un arranque fallido deja el worker inservible: la próxima ejecución crea otro.
      stopWorker()
      active = null
      run.reject(new Error(`No se pudo iniciar Python: ${message.message}`))
      break
  }
}

function startWorker(): Worker {
  const created = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  created.onmessage = (event: MessageEvent<FromWorker>) => handleMessage(event.data)
  created.onerror = (event) => {
    const run = active
    stopWorker()
    active = null
    run?.reject(new Error(`No se pudo iniciar Python: ${event.message || 'error al cargar el intérprete.'}`))
  }
  return created
}

function stopWorker(): void {
  worker?.terminate()
  worker = null
}

/** Corta el programa en curso: termina el worker, que se vuelve a crear en la próxima ejecución. */
function cancelActive(): void {
  const run = active
  stopWorker()
  active = null
  run?.resolve({ exitCode: CANCELLED_EXIT_CODE, cancelled: true })
}

export const python = {
  /** Ata la vida del intérprete a la de las apps y la sesión. Es seguro llamarla varias veces. */
  init(): void {
    if (initialized) return
    initialized = true
    on('app:terminated', ({ instanceId }) => {
      if (active?.instanceId === instanceId) cancelActive()
    })
    const release = () => {
      cancelActive()
    }
    on('session:logout', release)
    on('power:restart', release)
    on('power:shutdown', release)
  },

  run(context: AppContext, job: PythonJob, io: PythonIo): PythonRun {
    if (active) throw new Error('Ya hay un programa de Python en ejecución.')
    const id = nextId++
    const result = new Promise<PythonResult>((resolve, reject) => {
      active = { id, instanceId: context.instanceId, io, resolve, reject }
    })
    const message: ToWorker = {
      type: 'run',
      id,
      indexURL: new URL('pyodide/', document.baseURI).href,
      code: job.code,
      filename: job.filename ?? '',
      argv: JSON.stringify([job.filename ?? '-c', ...(job.args ?? [])])
    }
    worker ??= startWorker()
    worker.postMessage(message)
    return {
      result,
      cancel: () => {
        if (active?.id === id) cancelActive()
      }
    }
  }
}
