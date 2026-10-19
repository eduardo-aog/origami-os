import type { ReactNode } from 'react'
import './List.css'

export function List({ children, 'aria-label': ariaLabel }: { children: ReactNode; 'aria-label'?: string }) {
  return (
    <ul className="os-list" aria-label={ariaLabel}>
      {children}
    </ul>
  )
}

export interface ListItemProps {
  title: string
  subtitle?: string
  leading?: ReactNode
  trailing?: ReactNode
  selected?: boolean
  disabled?: boolean
  /** Si se indica, la fila entera se puede pulsar. */
  onClick?: () => void
}

export function ListItem({ title, subtitle, leading, trailing, selected = false, disabled = false, onClick }: ListItemProps) {
  const content = (
    <>
      {leading ? <span className="os-list__leading">{leading}</span> : null}
      <span className="os-list__text">
        <span className="os-list__title">{title}</span>
        {subtitle ? <span className="os-list__subtitle">{subtitle}</span> : null}
      </span>
    </>
  )
  return (
    <li className="os-list__item" aria-selected={selected || undefined}>
      {onClick ? (
        <button type="button" className="os-list__main" disabled={disabled} onClick={onClick}>
          {content}
        </button>
      ) : (
        <div className="os-list__main">{content}</div>
      )}
      {trailing ? <span className="os-list__trailing">{trailing}</span> : null}
    </li>
  )
}
