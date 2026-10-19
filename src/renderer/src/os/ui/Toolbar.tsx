import type { ReactNode } from 'react'
import './Toolbar.css'

export interface ToolbarProps {
  children: ReactNode
  className?: string
  'aria-label'?: string
}

/** Barra de herramientas horizontal; sus hijos se alinean a la izquierda salvo tras un `ToolbarSpacer`. */
export function Toolbar({ children, className, 'aria-label': ariaLabel }: ToolbarProps) {
  return (
    <div role="toolbar" aria-label={ariaLabel} className={['os-toolbar', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

export function ToolbarSeparator() {
  return <span className="os-toolbar__separator" role="separator" aria-orientation="vertical" />
}

/** Empuja a la derecha lo que va después. */
export function ToolbarSpacer() {
  return <span className="os-toolbar__spacer" />
}
