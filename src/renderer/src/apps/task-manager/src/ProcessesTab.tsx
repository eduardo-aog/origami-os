import { Cpu } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AppIcon, Button } from '@os/ui'
import { useOS, useProcesses, type ProcessInfo, type ProcessState, type SystemSnapshot } from '@os/sdk'
import { formatCpu, formatMemory } from './format'
import { StateBadge } from './StateBadge'

type SortKey = 'name' | 'pid' | 'state' | 'cpu' | 'memory'

const COLUMNS: { key: SortKey | null; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Nombre', numeric: false },
  { key: 'pid', label: 'PID', numeric: true },
  { key: 'state', label: 'Estado', numeric: false },
  { key: null, label: 'Detalle', numeric: false },
  { key: 'cpu', label: 'CPU', numeric: true },
  { key: 'memory', label: 'Memoria', numeric: true }
]

const STATE_ORDER: Record<ProcessState, number> = { running: 0, ready: 1, waiting: 2, new: 3, terminated: 4 }

function compare(a: ProcessInfo, b: ProcessInfo, key: SortKey): number {
  switch (key) {
    case 'pid':
      return a.pid - b.pid
    case 'state':
      return STATE_ORDER[a.state] - STATE_ORDER[b.state]
    case 'cpu':
      return a.cpu - b.cpu
    case 'memory':
      return a.memoryMB - b.memoryMB
    default:
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  }
}

function detail(process: ProcessInfo): string {
  if (process.state === 'running') return `Núcleo ${(process.core ?? 0) + 1}`
  if (process.state === 'waiting') return process.waitingFor ?? ''
  if (process.state === 'ready') return 'En la cola de listos'
  return ''
}

export function ProcessesTab({ snapshot }: { snapshot: SystemSnapshot }) {
  const os = useOS()
  const { forceQuit, terminateTest } = useProcesses()
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: 'state', direction: 1 })
  const [selectedPid, setSelectedPid] = useState<number | null>(null)

  const rows = useMemo(
    () => [...snapshot.processes].sort((a, b) => compare(a, b, sort.key) * sort.direction || a.pid - b.pid),
    [snapshot.processes, sort]
  )
  const selected = rows.find((process) => process.pid === selectedPid)
  const live = snapshot.processes.filter((process) => process.state !== 'terminated').length

  const isApp = selected?.instanceId != null && selected.state !== 'terminated'
  const isTest = selected?.kind === 'test' && selected.state !== 'terminated'

  async function quit() {
    if (!selected) return
    if (isTest) terminateTest(selected.pid)
    else if (selected.instanceId && (await forceQuit(selected.instanceId))) setSelectedPid(null)
  }

  return (
    <div className="task-manager__panel">
      <div className="task-manager__bar">
        <div className="task-manager__summary">
          <span>
            CPU <strong>{formatCpu(snapshot.cpu)}</strong>
          </span>
          <span>
            Memoria{' '}
            <strong>
              {formatMemory(snapshot.memoryUsedMB)} de {formatMemory(snapshot.memoryTotalMB)}
            </strong>
          </span>
          <span>
            Procesos <strong>{live}</strong>
          </span>
        </div>
        <Button
          variant="danger"
          disabled={!isApp && !isTest}
          title={selected && !isApp && !isTest ? 'Este proceso no se puede cerrar desde aquí.' : undefined}
          onClick={() => void quit()}
        >
          {isTest ? 'Terminar' : 'Forzar cierre'}
        </Button>
      </div>
      <div className="task-manager__scroll">
        <table className="task-manager__table">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.label}
                  className={column.numeric ? 'task-manager__number' : undefined}
                  aria-sort={
                    column.key !== null && sort.key === column.key
                      ? sort.direction === 1
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  {column.key === null ? (
                    <span className="task-manager__sort">{column.label}</span>
                  ) : (
                    <button
                      type="button"
                      className="task-manager__sort"
                      onClick={() => {
                        const key = column.key
                        if (key === null) return
                        setSort((current) => ({
                          key,
                          direction:
                            current.key === key
                              ? current.direction === 1
                                ? -1
                                : 1
                              : key === 'name' || key === 'pid' || key === 'state'
                                ? 1
                                : -1
                        }))
                      }}
                    >
                      {column.label}
                      {sort.key === column.key ? (sort.direction === 1 ? ' ▴' : ' ▾') : ''}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((process) => {
              const iconUrl = process.appId ? os.apps.getIconUrl(process.appId) : undefined
              return (
                <tr
                  key={process.pid}
                  aria-selected={process.pid === selectedPid}
                  className={process.state === 'terminated' ? 'task-manager__row--terminated' : undefined}
                  onClick={() => setSelectedPid(process.pid)}
                >
                  <td>
                    <span className="task-manager__name">
                      {iconUrl ? (
                        <AppIcon src={iconUrl} size={20} />
                      ) : (
                        <span className="task-manager__system-icon">
                          <Cpu size={15} />
                        </span>
                      )}
                      {process.name}
                    </span>
                  </td>
                  <td className="task-manager__number">{process.pid}</td>
                  <td>
                    <StateBadge state={process.state} />
                  </td>
                  <td>{detail(process)}</td>
                  <td className="task-manager__number">{process.state === 'terminated' ? '—' : formatCpu(process.cpu)}</td>
                  <td className="task-manager__number">
                    {process.state === 'terminated' ? '—' : formatMemory(process.memoryMB)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {selected ? (
        <div className="task-manager__detail">
          <strong>
            {selected.name} · PID {selected.pid}
          </strong>
          <span>
            Ticks en ejecución <strong>{selected.runTicks}</strong>
          </span>
          <span>
            en cola de listos <strong>{selected.readyTicks}</strong>
          </span>
          <span>
            en espera <strong>{selected.waitTicks}</strong>
          </span>
          <span>
            Recursos que posee <strong>{selected.holding.length > 0 ? selected.holding.join(', ') : 'ninguno'}</strong>
          </span>
        </div>
      ) : null}
    </div>
  )
}
