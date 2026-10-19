import { dialogs } from '../dialogs'
import { confirmWindowDiscard } from '../dialogs/unsaved'
import { fs } from '../fs'
import { windowsStore, type WindowRecord } from '../windows/store'
import { extensionOf, getAppsForExtension, resolveDefaultApp } from './associations'
import type { AppManifest } from './manifest.schema'
import { getApp } from './registry'
import { FILES_APP_ID } from './system-apps'
import type { LaunchArgs } from './types'

export { extensionOf, getAppsForExtension, resolveDefaultApp, setDefaultApp } from './associations'

const openFileHandlers = new Map<string, (path: string) => void>()

/** Las apps de instancia única reciben aquí los archivos nuevos (`useOpenFileHandler`). */
export function registerOpenFileHandler(instanceId: string, handler: (path: string) => void): () => void {
  openFileHandlers.set(instanceId, handler)
  return () => {
    if (openFileHandlers.get(instanceId) === handler) openFileHandlers.delete(instanceId)
  }
}

async function deliverToExisting(window: WindowRecord, args: LaunchArgs): Promise<void> {
  windowsStore.focus(window.id)
  // Abrir otro archivo en una ventana con cambios sin guardar pasa por el flujo único.
  if (args.filePath !== undefined && !(await confirmWindowDiscard(window.id))) return
  windowsStore.deliverArgs(window.id, args)
  if (args.filePath !== undefined) openFileHandlers.get(window.instanceId)?.(args.filePath)
}

/** Abre una app. Si es de instancia única y ya está abierta, la enfoca y le entrega los argumentos. */
export function launchApp(appId: string, args: LaunchArgs = {}): void {
  const app = getApp(appId)
  if (!app) {
    console.error(`[apps] No existe la app "${appId}".`)
    return
  }
  if (app.manifest.window.singleInstance) {
    const existing = windowsStore.byApp(appId)[0]
    if (existing) {
      void deliverToExisting(existing, args)
      return
    }
  }
  windowsStore.open(app.manifest, args)
}

/** Apps que pueden abrir un archivo, de mayor a menor prioridad. */
export function getAppsForFile(path: string): AppManifest[] {
  return getAppsForExtension(extensionOf(path)).map((app) => app.manifest)
}

/** Abre un archivo con la app indicada o con la predeterminada; las carpetas se abren en Archivos. */
export async function openFile(path: string, appId?: string): Promise<void> {
  try {
    const node = await fs.stat(path)
    const absolute = await fs.pathOf(node.id)
    if (node.kind === 'folder') {
      launchApp(FILES_APP_ID, { filePath: absolute })
      return
    }
    const target = appId ?? resolveDefaultApp(extensionOf(node.name))?.manifest.id
    if (target === undefined) {
      await dialogs.system.alert({
        title: `No se puede abrir "${node.name}"`,
        message: 'No hay ninguna aplicación instalada que pueda abrir este tipo de archivo.'
      })
      return
    }
    launchApp(target, { filePath: absolute })
  } catch (error) {
    await dialogs.system.alert({
      title: 'No se pudo abrir el archivo',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}
