import { Check, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './ContextMenu.css'

export interface MenuItem {
  label?: string
  onSelect?: () => void
  disabled?: boolean
  destructive?: boolean
  checked?: boolean
  /** Texto del atajo (solo se muestra). */
  shortcut?: string
  separator?: boolean
  submenu?: MenuItem[]
}

/** Lista de opciones de un menú, con submenús. La usan los menús contextuales y los de la barra superior. */
export function MenuList({ items, onClose }: { items: MenuItem[]; onClose: () => void }) {
  const [open, setOpen] = useState<{ index: number; flip: boolean } | null>(null)

  return (
    <ul role="menu" className="os-menu">
      {items.map((item, index) =>
        item.separator ? (
          <li key={index} role="separator" className="os-menu__separator" />
        ) : (
          <li
            key={index}
            role="none"
            className="os-menu__row"
            onPointerEnter={(event) => {
              if (!item.submenu) {
                setOpen(null)
                return
              }
              const rect = event.currentTarget.getBoundingClientRect()
              setOpen({ index, flip: rect.right + 240 > window.innerWidth })
            }}
          >
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={`os-menu__item${item.destructive ? ' os-menu__item--destructive' : ''}`}
              onClick={() => {
                if (item.submenu) return
                item.onSelect?.()
                onClose()
              }}
            >
              <span className="os-menu__check">{item.checked ? <Check size={13} /> : null}</span>
              <span className="os-menu__label">{item.label}</span>
              {item.shortcut ? <span className="os-menu__shortcut">{item.shortcut}</span> : null}
              {item.submenu ? <ChevronRight size={13} className="os-menu__arrow" /> : null}
            </button>
            {item.submenu && open?.index === index ? (
              <div className={`os-menu__submenu${open.flip ? ' os-menu__submenu--flip' : ''}`}>
                <MenuList items={item.submenu} onClose={onClose} />
              </div>
            ) : null}
          </li>
        )
      )}
    </ul>
  )
}

export interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

/** Menú flotante en una posición de la pantalla. Se cierra con Esc, al hacer clic fuera o al perder el foco. */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Se acerca al borde de la pantalla si no cabe, sin pasar por el estado de React.
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const rect = element.getBoundingClientRect()
    element.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`
    element.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`
  }, [x, y, items])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
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
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      className="os-context-menu"
      style={{ left: x, top: y }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      // Los eventos de React atraviesan los portales: sin esto, un clic en el menú llegaría a quien lo abrió.
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <MenuList items={items} onClose={onClose} />
    </div>,
    document.body
  )
}

interface ContextMenuState {
  x: number
  y: number
  items: MenuItem[]
}

/** Estado de un menú contextual: `show` lo abre en la posición del evento y `menu` es lo que hay que renderizar. */
export function useContextMenu(): {
  show: (event: { clientX: number; clientY: number; preventDefault(): void }, items: MenuItem[]) => void
  menu: ReactNode
} {
  const [state, setState] = useState<ContextMenuState | null>(null)
  const close = useCallback(() => setState(null), [])
  const show = useCallback(
    (event: { clientX: number; clientY: number; preventDefault(): void }, items: MenuItem[]) => {
      event.preventDefault()
      setState({ x: event.clientX, y: event.clientY, items })
    },
    []
  )
  return { show, menu: state ? <ContextMenu x={state.x} y={state.y} items={state.items} onClose={close} /> : null }
}
