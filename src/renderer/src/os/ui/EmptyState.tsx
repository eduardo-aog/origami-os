import type { ReactNode } from 'react'
import './EmptyState.css'

export interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  /** Acciones opcionales (por ejemplo, un botón). */
  children?: ReactNode
}

export function EmptyState({ title, description, icon, children }: EmptyStateProps) {
  return (
    <div className="os-empty-state">
      {icon ? <div className="os-empty-state__icon">{icon}</div> : null}
      <p className="os-empty-state__title">{title}</p>
      {description ? <p className="os-empty-state__description">{description}</p> : null}
      {children ? <div className="os-empty-state__actions">{children}</div> : null}
    </div>
  )
}
