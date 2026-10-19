import { Cpu } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AppIcon, Button } from '@os/ui'
import { useOS, useProcesses, type ProcessInfo } from '@os/sdk'
import { formatCpu, formatMemory } from './format'
import type { Snapshot } from './useSnapshots'

type SortKey = 'name' | 'pid' | 'cpu' | 'memory'

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: 'name', label: 'Nombre', numeric: false },
  { key: 'pid', label: 'PID', numeric: true },
  { key: 'cpu', label: 'CPU', numeric: true },
  { key: 'memory', label: 'Memoria', numeric: true }
]

function compare(a: ProcessInfo, b: ProcessInfo, key: SortKey): number {
  switch (key) {
    case 'pid':
      return a.pid - b.pid
    case 'cpu':
      return a.cpu - b.cpu
    case 'memory':
      return a.memoryMB - b.memoryMB
    default:
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
  }
}

export function ProcessesTab({ snapshot }: { snapshot: Snapshot }) {
  const os = useOS()
  const { forceQuit } = useProcesses()
  const [sort, setSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: 'cpu', direction: -1 })
  const [selectedPid, setSelectedPid] = useState<number | null>(null)

  const rows = useMemo(
    () => [...snapshot.processes].sort((a, b) => compare(a, b, sort.key) * sort.direction || a.pid - b.pid),
    [snapshot.processes, sort]
  )
  const selected = rows.find((process) => process.pid === selectedPid)
  const canQuit = selected?.instanceId != null

  async function quit() {
    if (!selected?.instanceId) return
    if (await forceQuit(selected.instanceId)) setSelectedPid(null)
  }

  const { stats } = snapshot
  return (
    <div className="task-manager__panel">
      <div className="task-manager__bar">
        <div className="task-manager__summary">
          <span>
            CPU <strong>{formatCpu(stats.cpu)}</strong>
          </span>
          <span>
            Memoria{' '}
            <strong>
              {formatMemory(stats.memoryUsedMB)} de {formatMemory(stats.memoryTotalMB)}
            </strong>
          </span>
          <span>
            Procesos <strong>{snapshot.processes.length}</strong>
          </span>
        </div>
        <Button
          variant="danger"
          disabled={!canQuit}
          title={selected && !canQuit ? 'Los procesos del sistema no se pueden cerrar.' : undefined}
          onClick={() => void quit()}
        >
          Forzar cierre
        </Button>
      </div>
      <div className="task-manager__scroll">
        <table className="task-manager__table">
          <thead>
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className={column.numeric ? 'task-manager__number' : undefined}
                  aria-sort={sort.key === column.key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}
                >
                  <button
                    type="button"
                    className="task-manager__sort"
                    onClick={() =>
                      setSort((current) => ({
                        key: column.key,
                        direction: current.key === column.key ? (current.direction === 1 ? -1 : 1) : column.key === 'name' || column.key === 'pid' ? 1 : -1
                      }))
                    }
                  >
                    {column.label}
                    {sort.key === column.key ? (sort.direction === 1 ? ' ▴' : ' ▾') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((process) => {
              const iconUrl = process.appId ? os.apps.getIconUrl(process.appId) : undefined
              return (
                <tr key={process.pid} aria-selected={process.pid === selectedPid} onClick={() => setSelectedPid(process.pid)}>
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
                  <td className="task-manager__number">{formatCpu(process.cpu)}</td>
                  <td className="task-manager__number">{formatMemory(process.memoryMB)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
