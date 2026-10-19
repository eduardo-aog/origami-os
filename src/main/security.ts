import { app, session, systemPreferences, type WebContents } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const PRODUCTION_CSP = [
  "default-src 'self'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: mediastream:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'"
].join('; ')

/** URL del servidor de Vite; solo existe al ejecutar `npm run dev`. */
export function getDevServerUrl(): string | null {
  return app.isPackaged ? null : (process.env['ELECTRON_RENDERER_URL'] ?? null)
}

/** Carpeta del renderer compilado (`out/renderer`). */
export function getRendererDir(): string {
  return join(__dirname, '../renderer')
}

/** En desarrollo se añade solo lo que exige Vite: el script de React Refresh y el WebSocket de HMR. */
function buildCsp(devServerUrl: string | null): string {
  if (devServerUrl === null) return PRODUCTION_CSP
  const { host } = new URL(devServerUrl)
  return [
    PRODUCTION_CSP.replace("script-src 'self' 'wasm-unsafe-eval'", "script-src 'self' 'wasm-unsafe-eval' 'unsafe-inline'"),
    `connect-src 'self' ws://${host}`
  ].join('; ')
}

/** ¿La URL pertenece a la propia aplicación (no a un sitio externo)? */
export function isOwnAppUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const devServerUrl = getDevServerUrl()
    if (devServerUrl !== null) return parsed.origin === new URL(devServerUrl).origin
    const rendererPrefix = `${pathToFileURL(getRendererDir()).href}/`
    return parsed.protocol === 'file:' && parsed.href.startsWith(rendererPrefix)
  } catch {
    return false
  }
}

type MediaKind = 'camera' | 'microphone'

async function ensureOsMediaAccess(mediaTypes: readonly string[] | undefined): Promise<boolean> {
  if (process.platform !== 'darwin') return true
  const kinds = new Set<MediaKind>()
  for (const type of mediaTypes ?? []) {
    if (type === 'video') kinds.add('camera')
    if (type === 'audio') kinds.add('microphone')
  }
  for (const kind of kinds) {
    if (!(await systemPreferences.askForMediaAccess(kind))) return false
  }
  return true
}

/** Bloquea navegación, ventanas nuevas y webviews en cada WebContents que se cree. */
function hardenWebContents(contents: WebContents): void {
  contents.on('will-navigate', (event) => event.preventDefault())
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
}

/** Aplica la sección 3.4: CSP, permisos y bloqueo de navegación. Se llama una vez, tras `ready`. */
export function applySecurity(): void {
  const defaultSession = session.defaultSession
  const csp = buildCsp(getDevServerUrl())

  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] }
    })
  })

  // Solo `media` (cámara y micrófono) y solo para el origen propio. Todo lo demás se deniega.
  defaultSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (permission !== 'media' || !isOwnAppUrl(details.requestingUrl)) {
      callback(false)
      return
    }
    const mediaTypes = 'mediaTypes' in details ? details.mediaTypes : undefined
    ensureOsMediaAccess(mediaTypes).then(callback, () => callback(false))
  })

  defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) => {
    return permission === 'media' && isOwnAppUrl(details.requestingUrl || requestingOrigin)
  })

  app.on('web-contents-created', (_event, contents) => hardenWebContents(contents))
}
