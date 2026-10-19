import { useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { useStore } from 'zustand'
import { getNodeDrag, hasNodeDrag, setNodeDrag, useContextMenu, type MenuItem } from '@os/ui'
import { SETTINGS_APP_ID, widgets } from '../../kernel/apps'
import { launchApp, openFile } from '../../kernel/apps/launcher'
import { dialogs } from '../../kernel/dialogs'
import { fs } from '../../kernel/fs'
import { settings } from '../../kernel/settings'
import { useSettingValue } from '../../kernel/settings/hooks'
import { windowsStore } from '../../kernel/windows/store'
import { openWithItem } from '../context-menu/open-with'
import { useViewport } from '../common/useViewport'
import { Wallpaper } from '../wallpaper/Wallpaper'
import { addWidget } from '../widgets-host/actions'
import { WidgetsHost } from '../widgets-host/WidgetsHost'
import { DesktopIcon, entryLabel } from './DesktopIcon'
import {
  CELL_HEIGHT,
  CELL_WIDTH,
  cellKey,
  cellToPosition,
  clampCell,
  gridSize,
  nearestFreeCell,
  occupiedCells,
  positionToCell
} from './layout'
import { DESKTOP_PATH, useDesktopEntries, type DesktopEntry } from './useDesktopEntries'
import './Desktop.css'

interface Rubber {
  x0: number
  y0: number
  x1: number
  y1: number
}

const showError = (title: string, error: unknown) =>
  dialogs.system.alert({ title, message: error instanceof Error ? error.message : String(error) })

export function Desktop() {
  const rootRef = useRef<HTMLDivElement>(null)
  const viewport = useViewport()
  const reservedBottom = useStore(windowsStore, (state) => state.workArea.bottom)
  const grid = useMemo(() => gridSize(viewport, reservedBottom), [viewport, reservedBottom])
  const entries = useDesktopEntries(grid)
  const items = useSettingValue('desktop.items')

  const [selected, setSelected] = useState<string[]>([])
  const [rubber, setRubber] = useState<Rubber | null>(null)
  const [renamingNode, setRenamingNode] = useState<string | null>(null)
  const { show, menu } = useContextMenu()

  const entryById = (id: string) => entries.find((entry) => entry.item.id === id)

  /* ───── Acciones ───── */

  async function openEntry(entry: DesktopEntry) {
    if (entry.app) {
      launchApp(entry.app.manifest.id)
    } else if (entry.node) {
      try {
        await openFile(await fs.pathOf(entry.node.id))
      } catch (error) {
        await showError('No se pudo abrir', error)
      }
    }
  }

  async function trashEntries(targets: DesktopEntry[]) {
    const shortcuts = targets.filter((entry) => entry.app).map((entry) => entry.item.id)
    if (shortcuts.length > 0) {
      await settings.set('desktop.items', settings.get('desktop.items').filter((item) => !shortcuts.includes(item.id)))
    }
    for (const entry of targets) {
      if (!entry.node) continue
      try {
        await fs.trash(await fs.pathOf(entry.node.id))
      } catch (error) {
        await showError('No se pudo mover a la papelera', error)
      }
    }
    setSelected([])
  }

  async function createFolder() {
    let name = 'Nueva carpeta'
    for (let n = 2; await fs.exists(`${DESKTOP_PATH}/${name}`); n++) name = `Nueva carpeta (${n})`
    try {
      const node = await fs.mkdir(`${DESKTOP_PATH}/${name}`)
      setRenamingNode(node.id)
    } catch (error) {
      await showError('No se pudo crear la carpeta', error)
    }
  }

  async function renameNode(nodeId: string, name: string) {
    setRenamingNode(null)
    const current = entries.find((entry) => entry.node?.id === nodeId)?.node
    if (!current || name === current.name) return
    try {
      await fs.rename(await fs.pathOf(nodeId), name)
    } catch (error) {
      await showError('No se pudo renombrar', error)
    }
  }

  function arrangeIcons() {
    const ordered = [...entries].sort((a, b) => entryLabel(a).localeCompare(entryLabel(b), 'es', { numeric: true }))
    const positions = new Map(
      ordered.map((entry, index) => [
        entry.item.id,
        cellToPosition({ col: Math.floor(index / grid.rows), row: index % grid.rows })
      ])
    )
    void settings.set(
      'desktop.items',
      items.map((item) => ({ ...item, ...(positions.get(item.id) ?? {}) }))
    )
  }

  /* ───── Selección ───── */

  function pointerDownOnIcon(entry: DesktopEntry, event: PointerEvent) {
    if (event.button !== 0) return
    event.stopPropagation()
    windowsStore.focus(null)
    rootRef.current?.focus({ preventScroll: true })
    const id = entry.item.id
    if (event.ctrlKey || event.metaKey) {
      setSelected((ids) => (ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id]))
    } else if (event.shiftKey) {
      setSelected((ids) => (ids.includes(id) ? ids : [...ids, id]))
    } else if (!selected.includes(id)) {
      setSelected([id])
    }
  }

  function startRubberBand(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    windowsStore.focus(null)
    rootRef.current?.focus({ preventScroll: true })
    const additive = event.ctrlKey || event.metaKey || event.shiftKey
    const base = additive ? selected : []
    const origin = { x: event.clientX, y: event.clientY }
    setSelected(base)

    const onMove = (move: globalThis.PointerEvent) => {
      const area = {
        x0: Math.min(origin.x, move.clientX),
        y0: Math.min(origin.y, move.clientY),
        x1: Math.max(origin.x, move.clientX),
        y1: Math.max(origin.y, move.clientY)
      }
      setRubber(area)
      const hits = entries
        .filter(({ item }) => {
          const left = Math.min(item.x, viewport.width - CELL_WIDTH)
          return left + CELL_WIDTH - 10 > area.x0 && left + 10 < area.x1 && item.y + CELL_HEIGHT - 10 > area.y0 && item.y + 8 < area.y1
        })
        .map(({ item }) => item.id)
      setSelected([...new Set([...base, ...hits])])
    }
    const onEnd = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      setRubber(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
  }

  /* ───── Arrastrar y soltar ───── */

  function dragStart(entry: DesktopEntry, event: DragEvent) {
    const dragged = selected.includes(entry.item.id) ? selected : [entry.item.id]
    const ordered = [entry.item.id, ...dragged.filter((id) => id !== entry.item.id)]
    const rect = event.currentTarget.getBoundingClientRect()
    setNodeDrag(event, {
      nodeIds: ordered.flatMap((id) => entryById(id)?.node?.id ?? []),
      itemIds: ordered,
      grab: { x: event.clientX - rect.left, y: event.clientY - rect.top }
    })
  }

  async function drop(event: DragEvent) {
    const payload = getNodeDrag(event)
    if (!payload) return
    event.preventDefault()

    const anchor = payload.itemIds?.[0] !== undefined ? items.find((item) => item.id === payload.itemIds?.[0]) : undefined
    if (anchor && payload.grab && payload.itemIds) {
      // Reordenar: todos los elementos arrastrados se desplazan lo mismo que el que se agarró.
      const target = positionToCell(event.clientX - payload.grab.x, event.clientY - payload.grab.y)
      const from = positionToCell(anchor.x, anchor.y)
      const moving = new Set(payload.itemIds)
      const occupied = occupiedCells(items, moving)
      const next = items.map((item) => {
        if (!moving.has(item.id)) return item
        const cell = positionToCell(item.x, item.y)
        const wanted = clampCell({ col: cell.col + target.col - from.col, row: cell.row + target.row - from.row }, grid)
        const free = nearestFreeCell(wanted, occupied, grid)
        occupied.add(cellKey(free))
        return { ...item, ...cellToPosition(free) }
      })
      await settings.set('desktop.items', next)
      return
    }

    // Archivos que vienen de otro lugar: se mueven al escritorio.
    for (const nodeId of payload.nodeIds) {
      try {
        await fs.move(await fs.pathOf(nodeId), DESKTOP_PATH)
      } catch (error) {
        await showError('No se pudo mover al escritorio', error)
      }
    }
  }

  /* ───── Menús contextuales ───── */

  async function entryMenu(entry: DesktopEntry, event: MouseEvent) {
    const targets = selected.includes(entry.item.id) ? selected.flatMap((id) => entryById(id) ?? []) : [entry]
    if (!selected.includes(entry.item.id)) setSelected([entry.item.id])

    if (entry.app) {
      const appId = entry.app.manifest.id
      show(event, [
        { label: 'Abrir', onSelect: () => launchApp(appId) },
        { label: 'Quitar del escritorio', onSelect: () => void trashEntries(targets) },
        { separator: true },
        { label: 'Información', onSelect: () => void dialogs.system.about(appId) }
      ])
      return
    }
    const node = entry.node
    if (!node) return
    const path = await fs.pathOf(node.id)
    const items: MenuItem[] = [
      { label: 'Abrir', onSelect: () => void openEntry(entry) },
      ...(node.kind === 'file' ? [openWithItem(path)] : []),
      { separator: true },
      { label: 'Renombrar', disabled: node.system, onSelect: () => setRenamingNode(node.id) },
      { label: 'Mover a la papelera', destructive: true, disabled: node.system, onSelect: () => void trashEntries(targets) },
      { separator: true },
      { label: 'Información', onSelect: () => void dialogs.system.info(node.id) }
    ]
    show(event, items)
  }

  function backgroundMenu(event: MouseEvent) {
    show(event, [
      { label: 'Nueva carpeta', onSelect: () => void createFolder() },
      {
        label: 'Añadir widget',
        submenu: widgets.map((widget) => ({ label: widget.manifest.name, onSelect: () => addWidget(widget.manifest.id) }))
      },
      { separator: true },
      { label: 'Cambiar fondo de pantalla', onSelect: () => launchApp(SETTINGS_APP_ID, { section: 'appearance' }) },
      { label: 'Ordenar íconos', onSelect: arrangeIcons }
    ])
  }

  function onKeyDown(event: KeyboardEvent) {
    const targets = selected.flatMap((id) => entryById(id) ?? [])
    if (targets.length === 0) return
    if (event.key === 'Enter') {
      targets.forEach((entry) => void openEntry(entry))
    } else if (event.key === 'F2') {
      const node = targets.length === 1 ? targets[0]?.node : undefined
      if (node && !node.system) setRenamingNode(node.id)
    } else if (event.key === 'Delete') {
      void trashEntries(targets.filter((entry) => !entry.node?.system))
    }
  }

  return (
    <div
      ref={rootRef}
      className="desktop"
      tabIndex={-1}
      onPointerDown={startRubberBand}
      onContextMenu={backgroundMenu}
      onKeyDown={onKeyDown}
      onDragOver={(event) => {
        if (!hasNodeDrag(event)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(event) => void drop(event)}
    >
      <Wallpaper />
      <WidgetsHost />
      <div className="desktop__icons">
        {entries.map((entry) => (
          <DesktopIcon
            key={entry.item.id}
            entry={entry}
            x={Math.min(entry.item.x, Math.max(0, viewport.width - CELL_WIDTH))}
            y={entry.item.y}
            selected={selected.includes(entry.item.id)}
            renaming={entry.node !== undefined && entry.node.id === renamingNode}
            onPointerDown={(event) => pointerDownOnIcon(entry, event)}
            onOpen={() => void openEntry(entry)}
            onContextMenu={(event) => {
              event.stopPropagation()
              void entryMenu(entry, event)
            }}
            onDragStart={(event) => dragStart(entry, event)}
            onRenameCommit={(name) => entry.node && void renameNode(entry.node.id, name)}
            onRenameCancel={() => setRenamingNode(null)}
          />
        ))}
      </div>
      {rubber ? (
        <div
          className="desktop__rubber"
          style={{ left: rubber.x0, top: rubber.y0, width: rubber.x1 - rubber.x0, height: rubber.y1 - rubber.y0 }}
        />
      ) : null}
      {menu}
    </div>
  )
}
