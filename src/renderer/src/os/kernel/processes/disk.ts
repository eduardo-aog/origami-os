import { on } from '../events'
import { fs } from '../fs'

/** Espacio que el sistema ficticio reserva además de los archivos del usuario, en MB. */
export const SYSTEM_DISK_MB = 69222
const REFRESH_DELAY_MS = 500

let filesMB = 0
let timer: ReturnType<typeof setTimeout> | undefined

/** MB que ocupan los archivos reales del sistema de archivos virtual. */
export const getFilesMB = () => filesMB

async function refresh(onChange: () => void): Promise<void> {
  try {
    const { bytes } = await fs.usage()
    filesMB = bytes / (1024 * 1024)
    onChange()
  } catch {
    // Si el almacenamiento aún no está listo se conserva el último valor.
  }
}

/** Mantiene al día el espacio usado: lo lee al empezar y cada vez que cambia algún archivo. */
export function watchDisk(onChange: () => void): void {
  void refresh(onChange)
  on('fs:changed', () => {
    clearTimeout(timer)
    timer = setTimeout(() => void refresh(onChange), REFRESH_DELAY_MS)
  })
}
