import type { ProcessState } from '@os/sdk'

export const STATE_LABELS: Record<ProcessState, string> = {
  new: 'Nuevo',
  ready: 'Listo',
  running: 'En ejecución',
  waiting: 'En espera',
  terminated: 'Terminado'
}

export function StateBadge({ state }: { state: ProcessState }) {
  return <span className={`task-manager__badge task-manager__badge--${state}`}>{STATE_LABELS[state]}</span>
}
