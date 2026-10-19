import { useState } from 'react'
import { Button } from '@os/ui'
import { useOS } from '@os/sdk'
import { formatDuration, useNow } from './time'
import { usePersisted } from './usePersisted'

interface TimerState {
  durationMs: number
  status: 'idle' | 'running' | 'paused'
  /** Instante en que termina, mientras corre. */
  endsAt: number | null
  /** Tiempo que queda, mientras está en pausa. */
  remainingMs: number
  jobId: string | null
}

const IDLE: TimerState = { durationMs: 5 * 60_000, status: 'idle', endsAt: null, remainingMs: 0, jobId: null }
const PRESETS = [1, 5, 10, 15, 30]
const RING_RADIUS = 88
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.floor(value) || 0))

export function Timer() {
  const { scheduler, dialogs } = useOS()
  const timer = usePersisted<TimerState>('timer', IDLE)
  const state = timer.value
  const running = state.status === 'running'
  const now = useNow(100, running)
  const [error, setError] = useState<string | null>(null)

  const remaining = running && state.endsAt !== null ? Math.min(state.durationMs, Math.max(0, state.endsAt - now)) : state.status === 'paused' ? state.remainingMs : state.durationMs
  const finished = running && remaining === 0

  const hours = Math.floor(state.durationMs / 3_600_000)
  const minutes = Math.floor((state.durationMs % 3_600_000) / 60_000)
  const seconds = Math.floor((state.durationMs % 60_000) / 1000)

  function setDuration(h: number, m: number, s: number) {
    void timer.save({ ...state, durationMs: (clamp(h, 99) * 3600 + clamp(m, 59) * 60 + clamp(s, 59)) * 1000 })
  }

  async function launch(durationMs: number, total: number) {
    setError(null)
    try {
      const jobId = await scheduler.schedule({
        fireAt: Date.now() + durationMs,
        title: 'Temporizador',
        body: 'El tiempo ha terminado',
        sound: true,
        repeat: 'none',
        payload: { kind: 'timer' }
      })
      await timer.save({ durationMs: total, status: 'running', endsAt: Date.now() + durationMs, remainingMs: 0, jobId })
    } catch (reason) {
      await dialogs.alert({ title: 'No se pudo iniciar el temporizador', message: reason instanceof Error ? reason.message : String(reason) })
    }
  }

  async function dropJob() {
    if (state.jobId !== null) await scheduler.cancel(state.jobId)
  }

  async function start() {
    if (state.durationMs <= 0) {
      setError('Elige una duración mayor que cero.')
      return
    }
    await launch(state.durationMs, state.durationMs)
  }

  async function pause() {
    await dropJob()
    await timer.save({ ...state, status: 'paused', endsAt: null, remainingMs: remaining, jobId: null })
  }

  async function reset() {
    await dropJob()
    await timer.save({ ...state, status: 'idle', endsAt: null, remainingMs: 0, jobId: null })
  }

  const progress = state.status === 'idle' || state.durationMs === 0 ? 1 : remaining / state.durationMs

  return (
    <div className="clock__timer">
      <div className="clock__ring">
        <svg viewBox="0 0 200 200" className="clock__ring-svg" aria-hidden="true">
          <circle className="clock__ring-track" cx="100" cy="100" r={RING_RADIUS} />
          <circle
            className="clock__ring-progress"
            cx="100"
            cy="100"
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - progress)}
          />
        </svg>
        <div className="clock__ring-content">
          {state.status === 'idle' ? (
            <div className="clock__duration">
              <label>
                <input
                  className="clock__duration-input"
                  type="number"
                  min={0}
                  max={99}
                  aria-label="Horas"
                  value={hours}
                  onChange={(event) => setDuration(event.target.valueAsNumber, minutes, seconds)}
                />
                <span>h</span>
              </label>
              <label>
                <input
                  className="clock__duration-input"
                  type="number"
                  min={0}
                  max={59}
                  aria-label="Minutos"
                  value={minutes}
                  onChange={(event) => setDuration(hours, event.target.valueAsNumber, seconds)}
                />
                <span>min</span>
              </label>
              <label>
                <input
                  className="clock__duration-input"
                  type="number"
                  min={0}
                  max={59}
                  aria-label="Segundos"
                  value={seconds}
                  onChange={(event) => setDuration(hours, minutes, event.target.valueAsNumber)}
                />
                <span>s</span>
              </label>
            </div>
          ) : (
            <>
              <span className="clock__countdown" aria-live="off">
                {formatDuration(Math.ceil(remaining / 1000) * 1000)}
              </span>
              <span className="clock__countdown-note">
                {finished ? 'Tiempo terminado' : state.status === 'paused' ? 'En pausa' : `de ${formatDuration(state.durationMs)}`}
              </span>
            </>
          )}
        </div>
      </div>

      {error ? (
        <p className="clock__error" role="alert">
          {error}
        </p>
      ) : null}

      {state.status === 'idle' ? (
        <>
          <div className="clock__presets">
            {PRESETS.map((preset) => (
              <Button key={preset} onClick={() => setDuration(Math.floor(preset / 60), preset % 60, 0)}>
                {preset} min
              </Button>
            ))}
          </div>
          <div className="clock__buttons">
            <Button variant="primary" disabled={!timer.loaded} onClick={() => void start()}>
              Iniciar
            </Button>
          </div>
        </>
      ) : (
        <div className="clock__buttons">
          <Button onClick={() => void reset()}>{finished ? 'Aceptar' : 'Cancelar'}</Button>
          {finished ? null : running ? (
            <Button variant="primary" onClick={() => void pause()}>
              Pausar
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void launch(state.remainingMs, state.durationMs)}>
              Reanudar
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
