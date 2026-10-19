import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, EmptyState } from '@os/ui'

interface Props {
  appName: string
  onClose: () => void
  children: ReactNode
}

/** Evita que el fallo de una app arrastre al resto del sistema. */
export class AppErrorBoundary extends Component<Props, { failed: boolean }> {
  override state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[ventanas] "${this.props.appName}" falló:`, error, info.componentStack)
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <EmptyState
        title={`${this.props.appName} dejó de funcionar`}
        description="Ocurrió un error inesperado. Puedes cerrar esta ventana y volver a abrir la aplicación."
      >
        <Button onClick={this.props.onClose}>Cerrar</Button>
      </EmptyState>
    )
  }
}
