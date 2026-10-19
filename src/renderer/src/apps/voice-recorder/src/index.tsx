import { useEffect, useRef, useState } from 'react'
import { Mic, Pause, Pencil, Play, Square, Trash2 } from 'lucide-react'
import { EmptyState, IconButton, formatBytes, formatDateTime, formatDuration, useFsObjectUrl } from '@os/ui'
import { useFsWatch, useOS, useSystemVolume, useUnsavedChanges } from '@os/sdk'
import {
  RECORDING_EXTENSION,
  RECORDINGS_FOLDER,
  preferredMimeType,
  recordingName,
  stripExtension,
  validateName
} from './recording'
import './voice-recorder.css'

type Status = 'idle' | 'recording' | 'paused'

interface Session {
  recorder: MediaRecorder
  stream: MediaStream
  chunks: Blob[]
  context: AudioContext
  analyser: AnalyserNode
  name: string
}

const WAVE_INTERVAL_MS = 40
const TICK_MS = 200
const FFT_SIZE = 1024

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))

export default function App() {
  const os = useOS()
  const { fs, dialogs } = os
  const systemVolume = useSystemVolume()

  const [status, setStatus] = useState<Status>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [pendingName, setPendingName] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const [playingPath, setPlayingPath] = useState<string | null>(null)
  const [playTime, setPlayTime] = useState(0)

  const root = useRef<HTMLDivElement>(null)
  const wave = useRef<HTMLCanvasElement>(null)
  const player = useRef<HTMLAudioElement>(null)
  const session = useRef<Session | null>(null)
  const clock = useRef({ accumulated: 0, startedAt: 0 })

  const recordings = useFsWatch(RECORDINGS_FOLDER)
  const sorted = [...recordings].filter((node) => node.kind === 'file').sort((a, b) => b.modifiedAt - a.modifiedAt)
  const { url: playUrl } = useFsObjectUrl(playingPath)

  useEffect(() => {
    root.current?.focus()
  }, [])

  useEffect(() => {
    if (player.current) player.current.volume = systemVolume
  }, [systemVolume, playUrl])

  // El tiempo transcurrido y la onda solo avanzan mientras se graba; en pausa se quedan como están.
  useEffect(() => {
    if (status !== 'recording') return
    const tick = setInterval(() => {
      setElapsed(clock.current.accumulated + (Date.now() - clock.current.startedAt))
    }, TICK_MS)
    const draw = setInterval(() => {
      const current = session.current
      if (current) drawWave(wave.current, current.analyser)
    }, WAVE_INTERVAL_MS)
    return () => {
      clearInterval(tick)
      clearInterval(draw)
    }
  }, [status])

  useEffect(() => {
    if (status === 'idle') drawWave(wave.current, null)
  }, [status])

  // Si la ventana se cierra con una grabación en curso (tras elegir «No guardar»), se libera el micrófono.
  useEffect(
    () => () => {
      const current = session.current
      if (!current) return
      session.current = null
      current.recorder.onstop = null
      if (current.recorder.state !== 'inactive') current.recorder.stop()
      release(current)
    },
    []
  )

  async function start() {
    setProblem(null)
    let stream: MediaStream
    try {
      stream = await os.media.getMicrophone()
    } catch (error) {
      setProblem(describeError(error))
      return
    }
    const context = new AudioContext()
    const analyser = context.createAnalyser()
    analyser.fftSize = FFT_SIZE
    context.createMediaStreamSource(stream).connect(analyser)

    const mimeType = preferredMimeType()
    const recorder = new MediaRecorder(stream, mimeType === undefined ? undefined : { mimeType })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    const name = recordingName(new Date())
    session.current = { recorder, stream, chunks, context, analyser, name }
    recorder.start(1000)

    clock.current = { accumulated: 0, startedAt: Date.now() }
    setElapsed(0)
    setPendingName(name)
    setStatus('recording')
  }

  function togglePause() {
    const current = session.current
    if (!current) return
    if (current.recorder.state === 'recording') {
      current.recorder.pause()
      clock.current.accumulated += Date.now() - clock.current.startedAt
      setElapsed(clock.current.accumulated)
      setStatus('paused')
    } else if (current.recorder.state === 'paused') {
      current.recorder.resume()
      clock.current.startedAt = Date.now()
      setStatus('recording')
    }
  }

  /** Detiene la grabación y la guarda; devuelve `false` si no se pudo guardar. */
  function finish(): Promise<boolean> {
    const current = session.current
    if (!current) return Promise.resolve(true)
    return new Promise((resolve) => {
      current.recorder.onstop = () => {
        void persist(current).then(resolve)
      }
      current.recorder.stop()
    })
  }

  async function persist(finished: Session): Promise<boolean> {
    session.current = null
    release(finished)
    setStatus('idle')
    try {
      const blob = new Blob(finished.chunks, { type: finished.recorder.mimeType || 'audio/webm' })
      if (!(await fs.exists(RECORDINGS_FOLDER))) await fs.mkdir(RECORDINGS_FOLDER, { recursive: true })
      let name = finished.name
      for (let n = 2; await fs.exists(`${RECORDINGS_FOLDER}/${name}.${RECORDING_EXTENSION}`); n += 1) {
        name = `${finished.name} (${n})`
      }
      await fs.writeFile(`${RECORDINGS_FOLDER}/${name}.${RECORDING_EXTENSION}`, blob)
      return true
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo guardar la grabación', message: describeError(error) })
      return false
    }
  }

  useUnsavedChanges({ isDirty: status !== 'idle', documentName: pendingName, save: finish })

  async function rename(path: string, currentName: string) {
    const value = await dialogs.prompt({
      title: 'Renombrar grabación',
      defaultValue: stripExtension(currentName),
      validate: validateName
    })
    if (value === null) return
    try {
      await fs.rename(path, `${value.trim()}.${RECORDING_EXTENSION}`)
      if (playingPath === path) setPlayingPath(null)
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo renombrar', message: describeError(error) })
    }
  }

  async function remove(path: string, currentName: string) {
    const confirmed = await dialogs.confirm({
      title: `¿Mover «${stripExtension(currentName)}» a la papelera?`,
      message: 'Podrás recuperarla desde la papelera.',
      confirmLabel: 'Mover a la papelera',
      destructive: true
    })
    if (!confirmed) return
    try {
      if (playingPath === path) setPlayingPath(null)
      await fs.trash(path)
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo borrar', message: describeError(error) })
    }
  }

  const statusLabel = { idle: 'Listo para grabar', recording: 'Grabando…', paused: 'En pausa' }[status]

  return (
    <div ref={root} className="recorder" tabIndex={-1}>
      <section className="recorder__stage" aria-label="Grabación">
        <canvas ref={wave} className="recorder__wave" aria-hidden="true" />
        <p className="recorder__time" aria-live="off">
          {formatDuration(elapsed / 1000)}
        </p>
        <p className={status === 'recording' ? 'recorder__status recorder__status--live' : 'recorder__status'} role="status">
          {problem ?? statusLabel}
        </p>
        <div className="recorder__controls">
          {status === 'idle' ? (
            <button type="button" className="recorder__record" aria-label="Grabar" title="Grabar" onClick={() => void start()}>
              <Mic size={22} />
            </button>
          ) : (
            <>
              <IconButton
                label={status === 'recording' ? 'Pausar' : 'Reanudar'}
                className="recorder__round"
                onClick={togglePause}
              >
                {status === 'recording' ? <Pause size={18} /> : <Play size={18} />}
              </IconButton>
              <button
                type="button"
                className="recorder__record recorder__record--stop"
                aria-label="Detener y guardar"
                title="Detener y guardar"
                onClick={() => void finish()}
              >
                <Square size={18} />
              </button>
            </>
          )}
        </div>
      </section>

      <section className="recorder__list" aria-label="Grabaciones">
        <h2 className="recorder__heading">Grabaciones</h2>
        {sorted.length === 0 ? (
          <EmptyState title="Aún no hay grabaciones" description="Pulsa el botón rojo para empezar a grabar." />
        ) : (
          <ul className="recorder__items">
            {sorted.map((node) => {
              const path = `${RECORDINGS_FOLDER}/${node.name}`
              const active = playingPath === path
              return (
                <li key={node.id} className="recorder__item" aria-current={active || undefined}>
                  <IconButton
                    label={active ? `Detener «${stripExtension(node.name)}»` : `Reproducir «${stripExtension(node.name)}»`}
                    onClick={() => {
                      setPlayTime(0)
                      setPlayingPath(active ? null : path)
                    }}
                  >
                    {active ? <Pause size={16} /> : <Play size={16} />}
                  </IconButton>
                  <span className="recorder__item-text">
                    <span className="recorder__item-name">{stripExtension(node.name)}</span>
                    <span className="recorder__item-meta">
                      {active ? `${formatDuration(playTime)} · ` : ''}
                      {formatDateTime(node.modifiedAt)} · {formatBytes(node.size)}
                    </span>
                  </span>
                  <IconButton label={`Renombrar «${stripExtension(node.name)}»`} onClick={() => void rename(path, node.name)}>
                    <Pencil size={16} />
                  </IconButton>
                  <IconButton label={`Borrar «${stripExtension(node.name)}»`} onClick={() => void remove(path, node.name)}>
                    <Trash2 size={16} />
                  </IconButton>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <audio
        ref={player}
        src={playUrl ?? undefined}
        autoPlay
        onTimeUpdate={(event) => setPlayTime(event.currentTarget.currentTime)}
        onEnded={() => setPlayingPath(null)}
        onError={() => setPlayingPath(null)}
      />
    </div>
  )
}

function release(finished: Session): void {
  finished.stream.getTracks().forEach((track) => track.stop())
  void finished.context.close().catch(() => undefined)
}

/** Dibuja la forma de onda del micrófono; con `analyser` nulo, una línea plana. */
function drawWave(canvas: HTMLCanvasElement | null, analyser: AnalyserNode | null): void {
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx) return
  const ratio = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio))
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio))
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = 2 * ratio
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.strokeStyle = getComputedStyle(canvas).color
  ctx.beginPath()
  if (analyser === null) {
    ctx.moveTo(0, height / 2)
    ctx.lineTo(width, height / 2)
  } else {
    const samples = new Uint8Array(analyser.fftSize)
    analyser.getByteTimeDomainData(samples)
    samples.forEach((sample, index) => {
      const x = (index / (samples.length - 1)) * width
      const y = (sample / 255) * height
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
  }
  ctx.stroke()
}
