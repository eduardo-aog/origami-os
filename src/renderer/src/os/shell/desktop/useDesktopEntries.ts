import { useEffect, useMemo, useRef } from 'react'
import { getApp, type AppDefinition } from '../../kernel/apps'
import { useFsFolderState } from '../../kernel/fs/hooks'
import type { FsNode } from '../../kernel/fs'
import { settings } from '../../kernel/settings'
import { useSettingValue } from '../../kernel/settings/hooks'
import { cellToPosition, firstFreeCell, occupiedCells, type DesktopItem, type Grid } from './layout'

export const DESKTOP_PATH = '~/Escritorio'

/** Un elemento del escritorio: su posición guardada y el archivo o la app a la que representa. */
export interface DesktopEntry {
  item: DesktopItem
  node?: FsNode
  app?: AppDefinition
}

/**
 * Los elementos del escritorio: los archivos de ~/Escritorio y los accesos a apps de `desktop.items`.
 * Mantiene `desktop.items` al día: da una celda libre a cada archivo nuevo y quita lo que ya no existe.
 */
export function useDesktopEntries(grid: Grid): DesktopEntry[] {
  const { nodes, loaded } = useFsFolderState(DESKTOP_PATH)
  const items = useSettingValue('desktop.items')
  const reconciling = useRef(false)

  useEffect(() => {
    if (!loaded || reconciling.current) return
    const nodeIds = new Set(nodes.map((node) => node.id))
    const kept = items.filter((item) => (item.kind === 'app' ? getApp(item.ref) !== undefined : nodeIds.has(item.ref)))
    const placed = new Set(kept.filter((item) => item.kind === 'node').map((item) => item.ref))
    const occupied = occupiedCells(kept)
    const added: DesktopItem[] = []
    for (const node of nodes) {
      if (placed.has(node.id)) continue
      const cell = firstFreeCell(occupied, grid)
      occupied.add(`${cell.col}:${cell.row}`)
      added.push({ id: crypto.randomUUID(), kind: 'node', ref: node.id, ...cellToPosition(cell) })
    }
    if (added.length === 0 && kept.length === items.length) return
    reconciling.current = true
    settings
      .set('desktop.items', [...kept, ...added])
      .catch((error) => console.error('[escritorio] No se pudo guardar la disposición:', error))
      .finally(() => {
        reconciling.current = false
      })
  }, [loaded, nodes, items, grid])

  return useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    return items.flatMap<DesktopEntry>((item) => {
      if (item.kind === 'app') {
        const app = getApp(item.ref)
        return app ? [{ item, app }] : []
      }
      const node = byId.get(item.ref)
      return node ? [{ item, node }] : []
    })
  }, [items, nodes])
}
