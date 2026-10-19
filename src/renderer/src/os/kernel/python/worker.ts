import type { PyodideInterface } from 'pyodide'
import type { FromWorker, ToWorker } from './protocol'

interface WorkerScope {
  postMessage(message: FromWorker): void
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null
}

const scope = self as unknown as WorkerScope

/*
 * Ejecuta el programa en un espacio de nombres nuevo y devuelve el código de salida. Imprime los errores
 * como lo haría `python`, sin la línea de este envoltorio en el traceback.
 */
const RUNNER = `
import json
import sys
import traceback


def __simos_run(source, filename, argv_json):
    sys.argv = json.loads(argv_json)
    namespace = {"__name__": "__main__"}
    if filename:
        namespace["__file__"] = filename
    try:
        exec(compile(source, filename or "<string>", "exec"), namespace)
        return 0
    except SystemExit as stop:
        code = stop.code
        if code is None:
            return 0
        if isinstance(code, int):
            return code
        print(code, file=sys.stderr)
        return 1
    except BaseException as error:
        traceback.print_exception(type(error), error, error.__traceback__.tb_next)
        return 1
    finally:
        sys.stdout.flush()
        sys.stderr.flush()
`

let currentId = 0
let loaded: Promise<PyodideInterface> | null = null

async function load(indexURL: string): Promise<PyodideInterface> {
  scope.postMessage({ type: 'loading', id: currentId })
  const pyodideModule = (await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`)) as typeof import('pyodide')
  const pyodide = await pyodideModule.loadPyodide({ indexURL })
  pyodide.setStdout({ batched: (text) => scope.postMessage({ type: 'stdout', id: currentId, text }) })
  pyodide.setStderr({ batched: (text) => scope.postMessage({ type: 'stderr', id: currentId, text }) })
  // Sin entrada interactiva: `input()` recibe un fin de archivo y lanza EOFError.
  pyodide.setStdin({ stdin: () => undefined })
  pyodide.runPython(RUNNER)
  return pyodide
}

scope.onmessage = (event) => {
  const job = event.data
  currentId = job.id
  loaded ??= load(job.indexURL)
  loaded
    .then((pyodide) => {
      const exitCode = pyodide.globals.get('__simos_run')(job.code, job.filename, job.argv) as number
      scope.postMessage({ type: 'done', id: job.id, exitCode })
    })
    .catch((error: unknown) => {
      loaded = null
      scope.postMessage({ type: 'failed', id: job.id, message: error instanceof Error ? error.message : String(error) })
    })
}
