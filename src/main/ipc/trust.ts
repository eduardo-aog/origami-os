import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron'
import { isOwnAppUrl } from '../security'

/** Rechaza mensajes IPC que no vengan de una página de la propia aplicación. */
export function assertTrustedSender(event: IpcMainEvent | IpcMainInvokeEvent): void {
  const url = event.senderFrame?.url ?? ''
  if (!isOwnAppUrl(url)) {
    throw new Error(`Remitente IPC no confiable: ${url || '(desconocido)'}`)
  }
}
