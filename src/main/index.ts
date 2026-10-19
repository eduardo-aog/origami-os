import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import osConfig from '../renderer/src/system/os.config.json'
import { registerIpc } from './ipc'
import { installApplicationMenu } from './menu'
import { applySecurity, getDevServerUrl, getRendererDir } from './security'

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    title: osConfig.name,
    backgroundColor: '#121316',
    fullscreen: osConfig.startFullscreen,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // El sonido de arranque suena antes de que el usuario haya hecho clic en nada.
      autoplayPolicy: 'no-user-gesture-required'
    }
  })

  window.setMenuBarVisibility(false)
  // El título de la ventana lo define la configuración, no el <title> de la página.
  window.on('page-title-updated', (event) => event.preventDefault())
  window.once('ready-to-show', () => window.show())

  if (!app.isPackaged) {
    window.webContents.on('before-input-event', (event, input) => {
      const opensDevTools =
        input.type === 'keyDown' &&
        (input.key === 'F12' ||
          ((input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i'))
      if (opensDevTools) {
        window.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  }

  const devServerUrl = getDevServerUrl()
  if (devServerUrl !== null) {
    void window.loadURL(devServerUrl)
  } else {
    void window.loadFile(join(getRendererDir(), 'index.html'))
  }

  return window
}

app.whenReady().then(() => {
  applySecurity()
  registerIpc()
  installApplicationMenu()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => app.quit())
