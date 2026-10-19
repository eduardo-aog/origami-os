import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './IconButton.css'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'title'> {
  /** Nombre de la acción: es el texto alternativo y la ayuda emergente. */
  label: string
  /** Resalta el botón (por ejemplo, la vista que está activa). */
  active?: boolean
  children: ReactNode
}

export function IconButton({ label, active = false, type = 'button', className, children, ...rest }: IconButtonProps) {
  const classes = ['os-icon-button', active ? 'os-icon-button--active' : '', className].filter(Boolean).join(' ')
  return (
    <button type={type} className={classes} aria-label={label} title={label} aria-pressed={active || undefined} {...rest}>
      {children}
    </button>
  )
}
