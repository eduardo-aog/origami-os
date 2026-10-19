import { launchApp } from '../../kernel/apps/launcher'
import { dialogs } from '../../kernel/dialogs'
import { fs } from '../../kernel/fs'
import { settings } from '../../kernel/settings'
import { sound } from '../../kernel/sound'
import { windowsStore } from '../../kernel/windows/store'
import type { NodeDragPayload } from '@os/ui'
import { cellToPosition, firstFreeCell, gridSize, occupiedCells } from '../desktop/layout'

/** Abre la app, o enfoca (y restaura) su ventana más reciente si ya está abierta. */
export function activateApp(appId: string): void {
  const open = windowsStore.byApp(appId).sort((a, b) => b.zIndex - a.zIndex)[0]
  if (open) windowsStore.focus(open.id)
  else launchApp(appId)
}

export function pinToDock(appId: string): void {
  const pinned = settings.get('dock.pinned')
  if (!pinned.includes(appId)) void settings.set('dock.pinned', [...pinned, appId])
}

export function unpinFromDock(appId: string): void {
  void settings.set(
    'dock.pinned',
    settings.get('dock.pinned').filter((id) => id !== appId)
  )
}

/** Añade un acceso a la app en la primera celda libre del escritorio. */
export function addAppToDesktop(appId: string): void {
  const items = settings.get('desktop.items')
  if (items.some((item) => item.kind === 'app' && item.ref === appId)) return
  const grid = gridSize({ width: window.innerWidth, height: window.innerHeight }, windowsStore.getState().workArea.bottom)
  const cell = firstFreeCell(occupiedCells(items), grid)
  void settings.set('desktop.items', [...items, { id: crypto.randomUUID(), kind: 'app', ref: appId, ...cellToPosition(cell) }])
}

/** Lo que pasa al soltar algo sobre la Papelera: los archivos se envían a ella y los accesos de apps se quitan del escritorio. */
export async function dropOnTrash(payload: NodeDragPayload): Promise<void> {
  const items = settings.get('desktop.items')
  const appShortcuts = (payload.itemIds ?? []).filter((id) => items.find((item) => item.id === id)?.kind === 'app')
  if (appShortcuts.length > 0) {
    await settings.set(
      'desktop.items',
      items.filter((item) => !appShortcuts.includes(item.id))
    )
  }
  for (const nodeId of payload.nodeIds) {
    try {
      await fs.trash(await fs.pathOf(nodeId))
    } catch (error) {
      await dialogs.system.alert({
        title: 'No se pudo mover a la papelera',
        message: error instanceof Error ? error.message : String(error)
      })
    }
  }
  if (payload.nodeIds.length > 0 || appShortcuts.length > 0) sound.play('trash')
}
