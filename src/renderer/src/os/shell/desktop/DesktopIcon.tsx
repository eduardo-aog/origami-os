import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { AppIcon, FileIcon } from '@os/ui'
import { CELL_HEIGHT, CELL_WIDTH } from './layout'
import type { DesktopEntry } from './useDesktopEntries'

interface DesktopIconProps {
  entry: DesktopEntry
  x: number
  y: number
  selected: boolean
  renaming: boolean
  onPointerDown: (event: PointerEvent) => void
  onOpen: () => void
  onContextMenu: (event: MouseEvent) => void
  onDragStart: (event: DragEvent) => void
  onRenameCommit: (name: string) => void
  onRenameCancel: () => void
}

export function entryLabel(entry: DesktopEntry): string {
  return entry.node?.name ?? entry.app?.manifest.name ?? ''
}

/** Campo para renombrar sobre la etiqueta: selecciona el nombre sin la extensión. */
function RenameField({ name, onCommit, onCancel }: { name: string; onCommit: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(name)
  const ref = useRef<HTMLInputElement>(null)
  const finished = useRef(false)

  useEffect(() => {
    const input = ref.current
    if (!input) return
    input.focus()
    const dot = name.lastIndexOf('.')
    input.setSelectionRange(0, dot > 0 ? dot : name.length)
  }, [name])

  function finish(commit: boolean) {
    if (finished.current) return
    finished.current = true
    if (commit) onCommit(value)
    else onCancel()
  }

  function onKeyDown(event: KeyboardEvent) {
    event.stopPropagation()
    if (event.key === 'Enter') finish(true)
    else if (event.key === 'Escape') finish(false)
  }

  return (
    <input
      ref={ref}
      className="desktop-icon__rename"
      aria-label="Nombre"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(true)}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    />
  )
}

export function DesktopIcon({
  entry,
  x,
  y,
  selected,
  renaming,
  onPointerDown,
  onOpen,
  onContextMenu,
  onDragStart,
  onRenameCommit,
  onRenameCancel
}: DesktopIconProps) {
  const label = entryLabel(entry)
  return (
    <div
      className={`desktop-icon${selected ? ' desktop-icon--selected' : ''}`}
      style={{ left: x, top: y, width: CELL_WIDTH, height: CELL_HEIGHT }}
      data-desktop-item={entry.item.id}
      draggable={!renaming}
      onPointerDown={onPointerDown}
      onDoubleClick={onOpen}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
    >
      <div className="desktop-icon__image">
        {entry.node ? (
          <FileIcon kind={entry.node.kind} mime={entry.node.mime} system={entry.node.system} size={56} />
        ) : entry.app ? (
          <AppIcon src={entry.app.iconUrl} size={56} />
        ) : null}
      </div>
      {renaming ? (
        <RenameField name={label} onCommit={onRenameCommit} onCancel={onRenameCancel} />
      ) : (
        <span className="desktop-icon__label">{label}</span>
      )}
    </div>
  )
}
