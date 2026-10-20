import { Pause, Play, StepForward } from 'lucide-react'
import { Fragment, useMemo } from 'react'
import { Button, SegmentedControl } from '@os/ui'
import { TEST_LABELS, useProcesses, type ProcessState, type SystemSnapshot, type TestProfile } from '@os/sdk'
import { useTimeFormatter } from './format'
import { STATE_LABELS, StateBadge } from './StateBadge'

const SPEEDS = [
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '4', label: '4×' }
]

const TEST_PROFILES = Object.keys(TEST_LABELS) as TestProfile[]
const LOG_ROWS = 40

/** Las transiciones del diagrama de cinco estados. */
const EDGES: { from: ProcessState; to: ProcessState; label: string }[] = [
  { from: 'new', to: 'ready', label: 'Admitido por el planificador' },
  { from: 'ready', to: 'running', label: 'Despachado a un núcleo' },
  { from: 'running', to: 'ready', label: 'Quantum agotado (expropiación)' },
  { from: 'running', to: 'waiting', label: 'Pide E/S o un recurso ocupado' },
  { from: 'waiting', to: 'ready', label: 'Termina la E/S o recibe el recurso' },
  { from: 'running', to: 'terminated', label: 'Termina o se cierra' }
]

const DIAGRAM: ProcessState[] = ['new', 'ready', 'running', 'terminated', 'waiting']

export function StatesTab({ snapshot }: { snapshot: SystemSnapshot }) {
  const { setPaused, setSpeed, step, spawnTest } = useProcesses()
  const formatTime = useTimeFormatter()

  const counts = useMemo(() => {
    const result: Record<ProcessState, number> = { new: 0, ready: 0, running: 0, waiting: 0, terminated: 0 }
    for (const process of snapshot.processes) result[process.state]++
    return result
  }, [snapshot.processes])

  const edgeCounts = useMemo(() => {
    const result = new Map<string, number>()
    for (const t of snapshot.transitions) result.set(`${t.from}>${t.to}`, (result.get(`${t.from}>${t.to}`) ?? 0) + 1)
    return result
  }, [snapshot.transitions])

  const names = new Map(snapshot.processes.map((process) => [process.pid, process.name]))
  const nameOf = (pid: number) => names.get(pid) ?? `PID ${pid}`

  return (
    <div className="task-manager__panel">
      <div className="task-manager__bar">
        <div className="task-manager__controls">
          <Button onClick={() => setPaused(!snapshot.paused)}>
            {snapshot.paused ? <Play size={14} /> : <Pause size={14} />}
            {snapshot.paused ? 'Reanudar' : 'Pausar'}
          </Button>
          <Button disabled={!snapshot.paused} onClick={step} title="Avanza la simulación un tick">
            <StepForward size={14} />
            Paso
          </Button>
          <SegmentedControl
            aria-label="Velocidad de la simulación"
            value={String(snapshot.speed)}
            onChange={(value) => setSpeed(Number(value))}
            options={SPEEDS}
          />
        </div>
        <div className="task-manager__summary">
          <span>
            Tick <strong>{snapshot.tick}</strong>
          </span>
          <span>
            Quantum <strong>{snapshot.quantumTicks} ticks</strong>
          </span>
        </div>
      </div>

      <div className="task-manager__scroll task-manager__sections">
        <section className="task-manager__section">
          <h3 className="task-manager__heading">Ciclo de vida</h3>
          <div className="task-manager__states" role="list">
            {DIAGRAM.map((state) => (
              <div key={state} role="listitem" className={`task-manager__state task-manager__state--${state}`}>
                <span className="task-manager__state-count">{counts[state]}</span>
                <StateBadge state={state} />
              </div>
            ))}
          </div>
          <table className="task-manager__table task-manager__table--compact">
            <thead>
              <tr>
                <th>Transición</th>
                <th>Cuándo ocurre</th>
                <th className="task-manager__number">Veces</th>
              </tr>
            </thead>
            <tbody>
              {EDGES.map((edge) => (
                <tr key={`${edge.from}>${edge.to}`}>
                  <td>
                    {STATE_LABELS[edge.from]} → {STATE_LABELS[edge.to]}
                  </td>
                  <td>{edge.label}</td>
                  <td className="task-manager__number">{edgeCounts.get(`${edge.from}>${edge.to}`) ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="task-manager__section">
          <h3 className="task-manager__heading">Planificador (round-robin)</h3>
          <div className="task-manager__cores">
            {snapshot.coreSlots.map((pid, core) => (
              <div key={core} className="task-manager__core" data-busy={pid !== null}>
                <span className="task-manager__core-label">Núcleo {core + 1}</span>
                <span>{pid === null ? 'Libre' : nameOf(pid)}</span>
              </div>
            ))}
          </div>
          <div className="task-manager__queue" aria-label="Cola de listos">
            <span className="task-manager__core-label">Cola de listos</span>
            {snapshot.readyQueue.length === 0 ? (
              <span className="task-manager__muted">vacía</span>
            ) : (
              snapshot.readyQueue.map((pid, index) => (
                <Fragment key={pid}>
                  {index > 0 ? <span className="task-manager__muted">→</span> : null}
                  <span className="task-manager__chip">{nameOf(pid)}</span>
                </Fragment>
              ))
            )}
          </div>
          <div className="task-manager__controls">
            <span className="task-manager__muted">Crear proceso de prueba:</span>
            {TEST_PROFILES.map((profile) => (
              <Button key={profile} onClick={() => spawnTest(profile)}>
                {TEST_LABELS[profile]}
              </Button>
            ))}
          </div>
        </section>

        <section className="task-manager__section">
          <h3 className="task-manager__heading">Registro de transiciones</h3>
          <table className="task-manager__table task-manager__table--compact">
            <thead>
              <tr>
                <th>Hora</th>
                <th>Proceso</th>
                <th>Cambio de estado</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.transitions.slice(0, LOG_ROWS).map((transition) => (
                <tr key={transition.id}>
                  <td>{formatTime(transition.at)}</td>
                  <td className="task-manager__text">
                    {transition.name} <span className="task-manager__muted">({transition.pid})</span>
                  </td>
                  <td>
                    <span className="task-manager__change">
                      {transition.from ? <StateBadge state={transition.from} /> : <span className="task-manager__muted">—</span>}
                      →
                      <StateBadge state={transition.to} />
                    </span>
                  </td>
                  <td>{transition.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  )
}
