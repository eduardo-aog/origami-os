import { useEffect, useRef, type DragEvent, type MouseEvent } from 'react'

interface DockButtonProps {
  icon: string
  label: string
  running?: boolean
  highlighted?: boolean
  onActivate: () => void
  onContextMenu?: (event: MouseEvent) => void
  onDragOver?: (event: DragEvent) => void
  onDragLeave?: (event: DragEvent) => void
  onDrop?: (event: DragEvent) => void
  /** Registra este botón como destino de la animación de minimizar de una app. */
  registerTarget?: (locate: () => { x: number; y: number } | null) => () => void
}

/** Un ícono del Dock: el punto de "abierta", la etiqueta al pasar el cursor y la ampliación (la aplica el Dock). */
export function DockButton({
  icon,
  label,
  running = false,
  highlighted = false,
  onActivate,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
  registerTarget
}: DockButtonProps) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!registerTarget) return
    return registerTarget(() => {
      const rect = ref.current?.getBoundingClientRect()
      return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : null
    })
  }, [registerTarget])

  return (
    <button
      ref={ref}
      type="button"
      data-dock-item
      className={`dock__item${highlighted ? ' dock__item--highlighted' : ''}`}
      aria-label={label}
      onClick={onActivate}
      onContextMenu={onContextMenu}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <span className="dock__label">{label}</span>
      <img className="dock__icon" src={icon} alt="" draggable={false} />
      <span className={`dock__dot${running ? ' dock__dot--on' : ''}`} />
    </button>
  )
}
