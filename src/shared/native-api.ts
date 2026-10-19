/** Archivo del equipo real devuelto por el diálogo nativo de importación. */
export interface HostFile {
  name: string
  mime: string
  data: ArrayBuffer
  lastModified: number
}

export interface HostFileFilter {
  name: string
  extensions: string[]
}

export interface ImportFromHostOptions {
  multiple?: boolean
  filters?: HostFileFilter[]
}

export interface NativeApi {
  files: {
    /** Abre el diálogo nativo del equipo real y devuelve los archivos elegidos. */
    importFromHost(options?: ImportFromHostOptions): Promise<HostFile[]>
  }
  auth: {
    hashPassword(password: string): Promise<{ hash: string; salt: string }>
    verifyPassword(password: string, hash: string, salt: string): Promise<boolean>
  }
  power: {
    /** Cierra Electron (usado por "Apagar"). */
    quit(): void
    toggleFullscreen(): void
  }
  platform: { os: 'linux' | 'darwin' | 'win32' }
}

/** Canales IPC del puente. Los comparten `main/ipc` y `preload`. */
export const IPC_CHANNELS = {
  filesImportFromHost: 'native:files:import-from-host',
  authHashPassword: 'native:auth:hash-password',
  authVerifyPassword: 'native:auth:verify-password',
  powerQuit: 'native:power:quit',
  powerToggleFullscreen: 'native:power:toggle-fullscreen'
} as const
