/** Mensajes entre el hilo principal y el worker de Python. */

export type ToWorker = {
  type: 'run'
  id: number
  /** Carpeta (con barra final) desde la que se carga Pyodide. */
  indexURL: string
  code: string
  /** Nombre del archivo que se ejecuta; vacío si el código viene de `-c`. */
  filename: string
  /** `sys.argv` en JSON. */
  argv: string
}

export type FromWorker =
  | { type: 'loading'; id: number }
  | { type: 'stdout' | 'stderr'; id: number; text: string }
  | { type: 'done'; id: number; exitCode: number }
  | { type: 'failed'; id: number; message: string }
