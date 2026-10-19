import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import './Dialogs.css'

interface DialogFrameProps {
  title: string
  message?: string
  /** Pulsar Esc. */
  onCancel: () => void
  /** Pulsar Enter fuera de un botón o un campo multilínea. */
  onSubmit?: () => void
  wide?: boolean
  actions: ReactNode
  children?: ReactNode
}

/** Estructura común de los diálogos: título, mensaje, contenido y botones. Esc cancela y Enter confirma. */
export function DialogFrame({ title, message, onCancel, onSubmit, wide, actions, children }: DialogFrameProps) {
  const ref = useRef<HTMLDivElement>(null)

  // El foco entra en el diálogo para que Esc y Enter funcionen aunque no haya ningún campo.
  useEffect(() => {
    const element = ref.current
    if (element && !element.contains(document.activeElement)) element.focus({ preventScroll: true })
  }, [])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel()
    } else if (event.key === 'Enter' && onSubmit && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <div ref={ref} className={`dialog${wide ? ' dialog--wide' : ''}`} role="alertdialog" aria-label={title} tabIndex={-1} onKeyDown={onKeyDown}>
      <h2 className="dialog__title">{title}</h2>
      {message ? <p className="dialog__message">{message}</p> : null}
      {children}
      <div className="dialog__actions">{actions}</div>
    </div>
  )
}
