import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type NativeApi } from '../shared/native-api'

const hostOs: NativeApi['platform']['os'] =
  process.platform === 'darwin' || process.platform === 'win32' ? process.platform : 'linux'

const native: NativeApi = {
  files: {
    importFromHost: (options) => ipcRenderer.invoke(IPC_CHANNELS.filesImportFromHost, options)
  },
  auth: {
    hashPassword: (password) => ipcRenderer.invoke(IPC_CHANNELS.authHashPassword, password),
    verifyPassword: (password, hash, salt) =>
      ipcRenderer.invoke(IPC_CHANNELS.authVerifyPassword, password, hash, salt)
  },
  power: {
    quit: () => ipcRenderer.send(IPC_CHANNELS.powerQuit),
    toggleFullscreen: () => ipcRenderer.send(IPC_CHANNELS.powerToggleFullscreen)
  },
  platform: { os: hostOs }
}

contextBridge.exposeInMainWorld('native', native)
