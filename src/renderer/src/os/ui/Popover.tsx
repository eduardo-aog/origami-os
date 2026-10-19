import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Popover.css'

export interface PopoverProps {
  /** Elemento bajo el que se ancla (por ejemplo, el botón que lo abre). */
  anchor: HTMLElement | null
  open: boolean
  onClose: () => void
  /** Borde del ancla con el que se alinea. */
  align?: 'start' | 'end'
  className?: string
  children: ReactNode
}

/** Panel flotante anclado a un elemento. Se cierra con Esc o al hacer clic fuera (el ancla no cuenta como fuera). */
export function Popover({ anchor, open, onClose, align = 'start', className, children }: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const element = ref.current
    if (!open || !element || !anchor) return
    const anchorRect = anchor.getBoundingClientRect()
    const width = element.getBoundingClientRect().width
    const left = align === 'end' ? anchorRect.right - width : anchorRect.left
    element.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`
    element.style.top = `${anchorRect.bottom + 6}px`
  }, [open, anchor, align, children])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!ref.current?.contains(target) && !anchor?.contains(target)) onClose()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('blur', onClose)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('blur', onClose)
    }
  }, [open, anchor, onClose])

  if (!open) return null
  return createPortal(
    <div
      ref={ref}
      className={['os-popover', className].filter(Boolean).join(' ')}
      // Los eventos de React atraviesan los portales: sin esto, un clic en el panel llegaría a quien lo abrió.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  )
}
