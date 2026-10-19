import { app, BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/native-api'
import { assertTrustedSender } from './trust'

export function registerPowerIpc(): void {
  ipcMain.on(IPC_CHANNELS.powerQuit, (event) => {
    assertTrustedSender(event)
    app.quit()
  })

  ipcMain.on(IPC_CHANNELS.powerToggleFullscreen, (event) => {
    assertTrustedSender(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.setFullScreen(!window.isFullScreen())
  })
}
