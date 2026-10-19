import { settings } from '../settings'
import { apps, type AppDefinition } from './registry'

/** Extensión en minúsculas y sin punto; vacía si el nombre no tiene. */
export function extensionOf(fileName: string): string {
  const base = fileName.slice(fileName.lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

function priorityFor(app: AppDefinition, extension: string): number | null {
  const matching = app.manifest.fileAssociations.filter((entry) => entry.extensions.includes(extension))
  return matching.length === 0 ? null : Math.max(...matching.map((entry) => entry.priority))
}

function rank(list: { app: AppDefinition; priority: number }[]): AppDefinition[] {
  return list
    .sort(
      (a, b) =>
        b.priority - a.priority ||
        a.app.manifest.launchpad.order - b.app.manifest.launchpad.order ||
        a.app.manifest.name.localeCompare(b.app.manifest.name, 'es')
    )
    .map((entry) => entry.app)
}

/**
 * Apps que pueden abrir una extensión, de mayor a menor prioridad. Para una extensión sin
 * asociaciones se ofrecen los editores de texto plano, para poder abrir cualquier archivo.
 */
export function getAppsForExtension(extension: string): AppDefinition[] {
  const matching = apps.flatMap((app) => {
    const priority = priorityFor(app, extension)
    return priority === null ? [] : [{ app, priority }]
  })
  if (matching.length > 0) return rank(matching)
  return rank(
    apps.flatMap((app) => {
      const hasTextEditor = app.manifest.fileAssociations.some(
        (entry) => entry.role === 'editor' && entry.extensions.includes('txt')
      )
      return hasTextEditor ? [{ app, priority: 0 }] : []
    })
  )
}

/** App predeterminada: la que eligió el usuario (si sigue existiendo) o la de mayor prioridad. */
export function resolveDefaultApp(extension: string): AppDefinition | undefined {
  const chosen = settings.get('fileAssociations.defaults')[extension]
  const candidates = getAppsForExtension(extension)
  return candidates.find((app) => app.manifest.id === chosen) ?? candidates[0]
}

/** Recuerda la app elegida para una extensión ("Elegir siempre esta app"). */
export async function setDefaultApp(extension: string, appId: string): Promise<void> {
  await settings.set('fileAssociations.defaults', {
    ...settings.get('fileAssociations.defaults'),
    [extension]: appId
  })
}
