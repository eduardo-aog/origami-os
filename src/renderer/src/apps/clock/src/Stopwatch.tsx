import { Button } from '@os/ui'
import { formatDuration, pad, useNow } from './time'
import { usePersisted } from './usePersisted'

interface StopwatchState {
  running: boolean
  /** Instante en que arrancó la cuenta actual, mientras corre. */
  startedAt: number | null
  /** Tiempo acumulado antes de la cuenta actual. */
  elapsedBefore: number
  /** Tiempo total en cada vuelta, de la primera a la última. */
  laps: number[]
}

const STOPPED: StopwatchState = { running: false, startedAt: null, elapsedBefore: 0, laps: [] }

function formatElapsed(ms: number): string {
  return `${formatDuration(ms, false)},${pad(Math.floor((ms % 1000) / 10))}`
}

export function Stopwatch() {
  const stopwatch = usePersisted<StopwatchState>('stopwatch', STOPPED)
  const state = stopwatch.value
  const now = useNow(50, state.running)
  const elapsed = state.elapsedBefore + (state.running && state.startedAt !== null ? Math.max(0, now - state.startedAt) : 0)

  const start = () => stopwatch.save({ ...state, running: true, startedAt: Date.now() })
  const stop = () => stopwatch.save({ ...state, running: false, startedAt: null, elapsedBefore: elapsed })
  const lap = () => stopwatch.save({ ...state, laps: [...state.laps, elapsed] })
  const reset = () => stopwatch.save(STOPPED)

  const laps = state.laps.map((total, index) => ({ number: index + 1, total, split: total - (state.laps[index - 1] ?? 0) }))
  const splits = laps.map((entry) => entry.split)
  const best = Math.min(...splits)
  const worst = Math.max(...splits)

  return (
    <div className="clock__stopwatch">
      <div className="clock__elapsed" aria-live="off">
        {formatElapsed(elapsed)}
      </div>
      <div className="clock__buttons">
        {state.running ? (
          <Button onClick={() => void lap()}>Vuelta</Button>
        ) : (
          <Button disabled={elapsed === 0} onClick={() => void reset()}>
            Reiniciar
          </Button>
        )}
        {state.running ? (
          <Button variant="danger" onClick={() => void stop()}>
            Detener
          </Button>
        ) : (
          <Button variant="primary" disabled={!stopwatch.loaded} onClick={() => void start()}>
            {elapsed === 0 ? 'Iniciar' : 'Continuar'}
          </Button>
        )}
      </div>
      {laps.length > 0 ? (
        <div className="clock__laps">
          <table className="clock__laps-table">
            <thead>
              <tr>
                <th scope="col">Vuelta</th>
                <th scope="col">Parcial</th>
                <th scope="col">Total</th>
              </tr>
            </thead>
            <tbody>
              {[...laps].reverse().map((entry) => (
                <tr
                  key={entry.number}
                  className={
                    laps.length > 1 && entry.split === best ? 'clock__lap--best' : laps.length > 1 && entry.split === worst ? 'clock__lap--worst' : ''
                  }
                >
                  <td>{entry.number}</td>
                  <td>{formatElapsed(entry.split)}</td>
                  <td>{formatElapsed(entry.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
