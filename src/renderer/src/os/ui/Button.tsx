import type { ButtonHTMLAttributes } from 'react'
import './Button.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger'
}

export function Button({ variant = 'secondary', type = 'button', className, ...rest }: ButtonProps) {
  const classes = ['os-button', `os-button--${variant}`, className].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...rest} />
}
