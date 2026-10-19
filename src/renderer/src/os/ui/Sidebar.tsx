import type { ReactNode } from 'react'
import './Sidebar.css'

export interface SidebarItem {
  id: string
  label: string
  icon?: ReactNode
}

export interface SidebarProps {
  items: SidebarItem[]
  selected: string
  onSelect: (id: string) => void
  'aria-label'?: string
}

/** Lista vertical de secciones, como la barra lateral de Configuración. */
export function Sidebar({ items, selected, onSelect, 'aria-label': ariaLabel }: SidebarProps) {
  return (
    <nav className="os-sidebar" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="os-sidebar__item"
          aria-current={item.id === selected ? 'page' : undefined}
          onClick={() => onSelect(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
