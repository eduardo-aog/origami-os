import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera as CameraIcon, FlipHorizontal2, Video as VideoIcon } from 'lucide-react'
import { Button, FsImage, IconButton, SegmentedControl, Select, Toolbar, ToolbarSpacer, formatDuration } from '@os/ui'
import { useFsWatch, useOS, useUnsavedChanges } from '@os/sdk'
import {
  PHOTOS_FOLDER,
  VIDEOS_FOLDER,
  captureName,
  describeCameraError,
  preferredVideoType,
  type Mode,
  type TimerSeconds
} from './capture'
import './camera.css'

interface Prefs {
  mirror: boolean
  timer: TimerSeconds
}

interface StreamState {
  /** Identifica la petición a la que responde (dispositivo e intento). */
  key: string
  status: 'live' | 'error'
  error: string | null
  activeDevice: string | null
}

interface Recording {
  recorder: MediaRecorder
  chunks: Blob[]
  microphone: MediaStream | null
  name: string
}

const PREFS_KEY = 'prefs'
const DEFAULT_PREFS: Prefs = { mirror: true, timer: 0 }
const TICK_MS = 200

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error))

export default function App() {
  const os = useOS()
  const { fs, dialogs } = os

  const [mode, setMode] = useState<Mode>('photo')
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [streamState, setStreamState] = useState<StreamState | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [pendingName, setPendingName] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [flash, setFlash] = useState(0)

  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const session = useRef<Recording | null>(null)
  const countdownTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const startedAt = useRef(0)

  const photos = useFsWatch(PHOTOS_FOLDER)
  const clips = useFsWatch(VIDEOS_FOLDER)
  const latest = useMemo(() => {
    const all = [
      ...photos.map((node) => ({ node, folder: PHOTOS_FOLDER, kind: 'photo' as const })),
      ...clips.map((node) => ({ node, folder: VIDEOS_FOLDER, kind: 'video' as const }))
    ].filter((entry) => entry.node.kind === 'file')
    return all.reduce<(typeof all)[number] | null>(
      (best, entry) => (best === null || entry.node.modifiedAt > best.node.modifiedAt ? entry : best),
      null
    )
  }, [photos, clips])

  const requestKey = `${deviceId ?? 'default'}:${attempt}`
  const current = streamState !== null && streamState.key === requestKey ? streamState : null
  const live = current?.status === 'live'

  useEffect(() => {
    root.current?.focus()
  }, [])

  useEffect(() => {
    let active = true
    os.storage.get<Partial<Prefs>>(PREFS_KEY).then((saved) => {
      if (active && saved) setPrefs({ ...DEFAULT_PREFS, ...saved })
    })
    return () => {
      active = false
    }
  }, [os.storage])

  // La cámara solo está encendida mientras la ventana está abierta: al cambiar de dispositivo o cerrar se apaga.
  useEffect(() => {
    let active = true
    let opened: MediaStream | null = null
    const constraints: MediaTrackConstraints = {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      ...(deviceId === null ? {} : { deviceId: { exact: deviceId } })
    }
    os.media
      .getCamera(constraints)
      .then((result) => {
        if (!active) {
          result.getTracks().forEach((track) => track.stop())
          return
        }
        opened = result
        stream.current = result
        if (video.current) video.current.srcObject = result
        setStreamState({
          key: `${deviceId ?? 'default'}:${attempt}`,
          status: 'live',
          error: null,
          activeDevice: result.getVideoTracks()[0]?.getSettings().deviceId ?? null
        })
        // Hasta que se concede el permiso las cámaras no tienen nombre, así que la lista se pide ahora.
        return os.media.listCameras().then((list) => {
          if (active) setDevices(list)
        })
      })
      .catch((error: unknown) => {
        if (active) {
          setStreamState({
            key: `${deviceId ?? 'default'}:${attempt}`,
            status: 'error',
            error: describeCameraError(error),
            activeDevice: null
          })
        }
      })
    const element = video.current
    return () => {
      active = false
      opened?.getTracks().forEach((track) => track.stop())
      stream.current = null
      if (element) element.srcObject = null
    }
  }, [os.media, deviceId, attempt])

  useEffect(() => {
    if (!recording) return
    const tick = setInterval(() => setElapsed(Date.now() - startedAt.current), TICK_MS)
    return () => clearInterval(tick)
  }, [recording])

  useEffect(
    () => () => {
      clearInterval(countdownTimer.current)
      const open = session.current
      if (!open) return
      session.current = null
      open.recorder.onstop = null
      if (open.recorder.state !== 'inactive') open.recorder.stop()
      open.microphone?.getTracks().forEach((track) => track.stop())
    },
    []
  )

  function updatePrefs(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    void os.storage.set(PREFS_KEY, next)
  }

  async function uniquePath(folder: string, base: string, extension: string): Promise<string> {
    if (!(await fs.exists(folder))) await fs.mkdir(folder, { recursive: true })
    let name = base
    for (let n = 2; await fs.exists(`${folder}/${name}.${extension}`); n += 1) name = `${base} (${n})`
    return `${folder}/${name}.${extension}`
  }

  async function takePhoto() {
    const element = video.current
    if (!element || element.videoWidth === 0) return
    os.sound.playSystem('shutter')
    setFlash((value) => value + 1)
    try {
      const frame = document.createElement('canvas')
      frame.width = element.videoWidth
      frame.height = element.videoHeight
      frame.getContext('2d')?.drawImage(element, 0, 0)
      const blob = await new Promise<Blob>((resolve, reject) =>
        frame.toBlob((result) => (result ? resolve(result) : reject(new Error('No se pudo generar la foto.'))), 'image/png')
      )
      await fs.writeFile(await uniquePath(PHOTOS_FOLDER, captureName('photo', new Date()), 'png'), blob)
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo guardar la foto', message: describeError(error) })
    }
  }

  async function persist(finished: Recording): Promise<boolean> {
    session.current = null
    finished.microphone?.getTracks().forEach((track) => track.stop())
    setRecording(false)
    try {
      const blob = new Blob(finished.chunks, { type: finished.recorder.mimeType || 'video/webm' })
      await fs.writeFile(await uniquePath(VIDEOS_FOLDER, finished.name, 'webm'), blob)
      return true
    } catch (error) {
      await dialogs.alert({ title: 'No se pudo guardar el video', message: describeError(error) })
      return false
    }
  }

  /** Detiene la grabación y la guarda; devuelve `false` si no se pudo guardar. */
  function stopRecording(): Promise<boolean> {
    const open = session.current
    if (!open) return Promise.resolve(true)
    return new Promise((resolve) => {
      open.recorder.onstop = () => {
        void persist(open).then(resolve)
      }
      open.recorder.stop()
    })
  }

  async function startRecording() {
    const camera = stream.current
    if (!camera) return
    setNotice(null)
    const tracks = [...camera.getVideoTracks()]
    let microphone: MediaStream | null = null
    try {
      microphone = await os.media.getMicrophone()
      tracks.push(...microphone.getAudioTracks())
    } catch (error) {
      setNotice(`Se grabará sin audio. ${describeError(error)}`)
    }
    const type = preferredVideoType(microphone !== null)
    const recorder = new MediaRecorder(new MediaStream(tracks), type === undefined ? undefined : { mimeType: type })
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    const name = captureName('video', new Date())
    session.current = { recorder, chunks, microphone, name }
    recorder.start(1000)
    startedAt.current = Date.now()
    setElapsed(0)
    setPendingName(`${name}.webm`)
    setRecording(true)
  }

  useUnsavedChanges({ isDirty: recording, documentName: pendingName, save: stopRecording })

  function cancelCountdown() {
    clearInterval(countdownTimer.current)
    setCountdown(null)
  }

  function trigger() {
    if (countdown !== null) {
      cancelCountdown()
      return
    }
    if (mode === 'video' && recording) {
      void stopRecording()
      return
    }
    const run = () => (mode === 'photo' ? void takePhoto() : void startRecording())
    if (prefs.timer === 0) {
      run()
      return
    }
    let remaining: number = prefs.timer
    setCountdown(remaining)
    countdownTimer.current = setInterval(() => {
      remaining -= 1
      if (remaining > 0) {
        setCountdown(remaining)
        return
      }
      cancelCountdown()
      run()
    }, 1000)
  }

  function changeMode(next: Mode) {
    cancelCountdown()
    setMode(next)
  }

  const timerOptions: { value: string; label: string }[] = [
    { value: '0', label: 'Sin temporizador' },
    { value: '3', label: '3 s' },
    { value: '10', label: '10 s' }
  ]
  const busy = recording || countdown !== null

  return (
    <div ref={root} className="camera" tabIndex={-1}>
      <Toolbar className="camera__toolbar" aria-label="Opciones de la cámara">
        <SegmentedControl
          aria-label="Modo"
          value={mode}
          disabled={busy}
          onChange={changeMode}
          options={[
            { value: 'photo', label: 'Foto', icon: <CameraIcon size={13} /> },
            { value: 'video', label: 'Video', icon: <VideoIcon size={13} /> }
          ]}
        />
        <ToolbarSpacer />
        {devices.length > 1 ? (
          <Select
            aria-label="Cámara"
            value={deviceId ?? current?.activeDevice ?? ''}
            disabled={recording}
            onChange={(value) => {
              cancelCountdown()
              setDeviceId(value)
            }}
            options={devices.map((device, index) => ({
              value: device.deviceId,
              label: device.label || `Cámara ${index + 1}`
            }))}
          />
        ) : null}
        <Select
          aria-label="Temporizador"
          value={String(prefs.timer)}
          disabled={busy}
          onChange={(value) => updatePrefs({ timer: Number(value) as TimerSeconds })}
          options={timerOptions}
        />
        <IconButton label="Espejo" active={prefs.mirror} onClick={() => updatePrefs({ mirror: !prefs.mirror })}>
          <FlipHorizontal2 size={16} />
        </IconButton>
      </Toolbar>

      <div className="camera__stage">
        <video
          ref={video}
          className={['camera__video', prefs.mirror ? 'camera__video--mirror' : ''].filter(Boolean).join(' ')}
          autoPlay
          muted
          playsInline
        />
        {current === null ? <p className="camera__message">Iniciando la cámara…</p> : null}
        {current?.status === 'error' ? (
          <div className="camera__message">
            <p>{current.error}</p>
            <Button onClick={() => setAttempt((value) => value + 1)}>Reintentar</Button>
          </div>
        ) : null}
        {recording ? (
          <div className="camera__badge" role="status">
            <span className="camera__dot" aria-hidden="true" />
            {formatDuration(elapsed / 1000)}
          </div>
        ) : null}
        {notice !== null && recording ? <p className="camera__notice">{notice}</p> : null}
        {countdown !== null ? (
          <div className="camera__countdown" aria-live="assertive">
            {countdown}
          </div>
        ) : null}
        {flash > 0 ? <div key={flash} className="camera__flash" aria-hidden="true" /> : null}
      </div>

      <footer className="camera__footer">
        <div className="camera__side">
          {latest !== null ? (
            <button
              type="button"
              className="camera__thumb"
              aria-label="Abrir la última captura"
              title="Abrir la última captura"
              onClick={() => os.apps.openFile(`${latest.folder}/${latest.node.name}`)}
            >
              {latest.kind === 'photo' ? (
                <FsImage className="camera__thumb-image" nodeId={latest.node.id} />
              ) : (
                <VideoIcon size={22} />
              )}
            </button>
          ) : (
            <span className="camera__thumb camera__thumb--empty" aria-hidden="true" />
          )}
        </div>
        <button
          type="button"
          className={[
            'camera__shutter',
            mode === 'video' ? 'camera__shutter--video' : '',
            recording ? 'camera__shutter--recording' : ''
          ]
            .filter(Boolean)
            .join(' ')}
          aria-label={
            countdown !== null
              ? 'Cancelar cuenta atrás'
              : mode === 'photo'
                ? 'Tomar foto'
                : recording
                  ? 'Detener grabación'
                  : 'Grabar video'
          }
          disabled={!live}
          onClick={trigger}
        />
        <div className="camera__side camera__side--end">
          {notice !== null && !recording ? <span className="camera__hint">{notice}</span> : null}
        </div>
      </footer>
    </div>
  )
}
