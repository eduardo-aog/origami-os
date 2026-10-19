import { dialogs } from '.'

/** Lo que una app declara con `useUnsavedChanges` (sección 4.9). */
export interface UnsavedOptions {
  isDirty: boolean
  documentName: string
  /** `true` si guardó; `false` si el usuario canceló (por ejemplo en "Guardar como"). */
  save: () => Promise<boolean>
}

const registry = new Map<string, UnsavedOptions>()

export function registerUnsaved(windowId: string, options: UnsavedOptions): void {
  registry.set(windowId, options)
}

export function unregisterUnsaved(windowId: string): void {
  registry.delete(windowId)
}

export function isWindowDirty(windowId: string): boolean {
  return registry.get(windowId)?.isDirty === true
}

/**
 * Flujo único de cambios sin guardar. Si la ventana tiene cambios, el sistema (no la app) pregunta
 * "¿Guardar los cambios de …?". Devuelve `true` si se puede continuar (no había cambios, se
 * guardaron o se descartaron) y `false` si hay que abortar la operación completa.
 */
export async function confirmWindowDiscard(windowId: string): Promise<boolean> {
  const options = registry.get(windowId)
  if (!options?.isDirty) return true

  const answer = await dialogs.forWindow(windowId).unsaved(options.documentName)
  if (answer === 'cancel') return false
  if (answer === 'discard') return true
  return (registry.get(windowId) ?? options).save()
}
