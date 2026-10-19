import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import {
  FolderOpen,
  ListVideo,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Video,
  Volume1,
  Volume2,
  VolumeX
} from 'lucide-react'
import { Button, EmptyState, IconButton, Slider, formatDuration, useFsObjectUrl } from '@os/ui'
import { useAppMenus, useFsWatch, useLaunchArgs, useOS, useSystemVolume, type AppMenu } from '@os/sdk'
import {
  SEEK_STEP_S,
  VIDEO_EXTENSIONS,
  VOLUME_STEP,
  baseName,
  byName,
  folderOf,
  isVideoName,
  joinPath,
  titleOf
} from './playlist'
import './videos.css'

const IDLE_MS = 2500
const PREFS_KEY = 'prefs'

interface Prefs {
  volume: number
  muted: boolean
}

const DEFAULT_PREFS: Prefs = { volume: 0.8, muted: false }
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export default function App() {
  const os = useOS()
  const args = useLaunchArgs()
  const systemVolume = useSystemVolume()
  const initialPath = typeof args.filePath === 'string' ? args.filePath : null

  const [path, setPath] = useState<string | null>(initialPath)
  const [seenPath, setSeenPath] = useState(initialPath)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [fullscreen, setFullscreen] = useState(false)
  const [playlistOpen, setPlaylistOpen] = useState(true)
  const [idle, setIdle] = useState(false)

  const root = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const idleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Al cambiar de video se parte de cero, sin esperar a los eventos del elemento.
  if (seenPath !== path) {
    setSeenPath(path)
    setPlaying(false)
    setTime(0)
    setDuration(0)
    setFailed(false)
  }

  const folder = path === null ? '~/Videos' : folderOf(path)
  const siblings = useFsWatch(folder)
  const videos = useMemo(
    () => siblings.filter((node) => node.kind === 'file' && isVideoName(node.name)).sort(byName),
    [siblings]
  )
  const name = path === null ? null : baseName(path)
  const index = name === null ? -1 : videos.findIndex((node) => node.name === name)
  const { url, error: loadError } = useFsObjectUrl(path)
  const effectiveVolume = prefs.muted ? 0 : clamp01(prefs.volume * systemVolume)

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

  useEffect(() => {
    if (video.current) video.current.volume = effectiveVolume
  }, [effectiveVolume, url])

  useEffect(() => {
    os.window.setTitle(name === null ? os.app.manifest.name : `${titleOf(name)} — ${os.app.manifest.name}`)
  }, [os.window, os.app.manifest.name, name])

  useEffect(() => () => clearTimeout(idleTimer.current), [])

  function updatePrefs(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    void os.storage.set(PREFS_KEY, next)
  }

  function wake() {
    setIdle(false)
    clearTimeout(idleTimer.current)
    if (playing) idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS)
  }

  function togglePlay() {
    const element = video.current
    if (!element) return
    if (element.paused) void element.play().catch(() => setFailed(true))
    else element.pause()
  }

  function seek(seconds: number) {
    const element = video.current
    if (!element || duration === 0) return
    element.currentTime = Math.min(duration, Math.max(0, seconds))
    setTime(element.currentTime)
  }

  function go(step: 1 | -1) {
    const target = videos[index + step]
    if (target) setPath(joinPath(folder, target.name))
  }

  function toggleFullscreen() {
    setFullscreen((value) => !value)
    root.current?.focus()
  }

  async function pickVideo() {
    const picked = await os.dialogs.openFile({ startPath: path === null ? '~/Videos' : folder, extensions: VIDEO_EXTENSIONS })
    const target = picked?.[0]
    if (target !== undefined) setPath(target)
    root.current?.focus()
  }

  const hasPrevious = index > 0
  const hasNext = index !== -1 && index < videos.length - 1

  const menus: AppMenu[] = [
    {
      label: 'Archivo',
      items: [{ label: 'Abrir…', shortcut: 'Ctrl+O', onSelect: () => void pickVideo() }]
    },
    {
      label: 'Control',
      items: [
        { label: playing ? 'Pausar' : 'Reproducir', shortcut: 'Espacio', disabled: path === null, onSelect: togglePlay },
        { label: 'Retroceder 5 segundos', shortcut: '←', disabled: path === null, onSelect: () => seek(time - SEEK_STEP_S) },
        { label: 'Avanzar 5 segundos', shortcut: '→', disabled: path === null, onSelect: () => seek(time + SEEK_STEP_S) },
        { separator: true },
        { label: 'Video anterior', shortcut: 'Ctrl+←', disabled: !hasPrevious, onSelect: () => go(-1) },
        { label: 'Video siguiente', shortcut: 'Ctrl+→', disabled: !hasNext, onSelect: () => go(1) },
        { separator: true },
        { label: 'Silenciar', shortcut: 'M', checked: prefs.muted, onSelect: () => updatePrefs({ muted: !prefs.muted }) },
        { label: fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa', shortcut: 'F', disabled: path === null, onSelect: toggleFullscreen }
      ]
    }
  ]
  useAppMenus(menus)

  function onKeyDown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement && event.target.type !== 'range') return
    wake()
    const mod = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (mod && !event.altKey) {
      if (key === 'o') void pickVideo()
      else if (event.key === 'ArrowRight') go(1)
      else if (event.key === 'ArrowLeft') go(-1)
      else return
      event.preventDefault()
      return
    }
    if (mod || event.altKey || path === null) return
    if (event.key === ' ') togglePlay()
    else if (event.key === 'ArrowRight') seek(time + SEEK_STEP_S)
    else if (event.key === 'ArrowLeft') seek(time - SEEK_STEP_S)
    else if (event.key === 'ArrowUp') updatePrefs({ volume: clamp01(prefs.volume + VOLUME_STEP), muted: false })
    else if (event.key === 'ArrowDown') updatePrefs({ volume: clamp01(prefs.volume - VOLUME_STEP) })
    else if (key === 'm') updatePrefs({ muted: !prefs.muted })
    else if (key === 'f') toggleFullscreen()
    else if (event.key === 'Escape' && fullscreen) toggleFullscreen()
    else return
    event.preventDefault()
  }

  function onStagePointerMove(event: PointerEvent) {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen' || event.pointerType === 'touch') wake()
  }

  const VolumeIcon = effectiveVolume === 0 ? VolumeX : effectiveVolume < 0.5 ? Volume1 : Volume2
  const message = failed ? 'No se puede reproducir este video.' : loadError
  const showPlaylist = playlistOpen && videos.length > 1 && !fullscreen

  if (path === null) {
    return (
      <div ref={root} className="videos" tabIndex={-1} onKeyDown={onKeyDown}>
        <EmptyState
          icon={<Video size={40} />}
          title="No hay ningún video abierto"
          description="Abre un video para reproducirlo."
        >
          <Button variant="primary" onClick={() => void pickVideo()}>
            <FolderOpen size={14} />
            Abrir video…
          </Button>
        </EmptyState>
      </div>
    )
  }

  const hiddenControls = playing && idle
  return (
    <div
      ref={root}
      className={['videos', fullscreen ? 'videos--fullscreen' : ''].filter(Boolean).join(' ')}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div
        className={['videos__stage', hiddenControls ? 'videos__stage--idle' : ''].filter(Boolean).join(' ')}
        onPointerMove={onStagePointerMove}
        onPointerLeave={() => playing && setIdle(true)}
      >
        {url !== null ? (
          <video
            key={path}
            ref={video}
            className="videos__video"
            src={url}
            autoPlay
            preload="auto"
            onClick={togglePlay}
            onDoubleClick={toggleFullscreen}
            onPlay={() => {
              setPlaying(true)
              setFailed(false)
              clearTimeout(idleTimer.current)
              idleTimer.current = setTimeout(() => setIdle(true), IDLE_MS)
            }}
            onPause={() => {
              setPlaying(false)
              setIdle(false)
            }}
            onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
            onDurationChange={(event) =>
              setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)
            }
            onError={() => setFailed(true)}
          />
        ) : null}
        {message !== null ? <p className="videos__message">{message}</p> : null}

        <div className="videos__controls">
          <div className="videos__progress">
            <span className="videos__time">{formatDuration(time)}</span>
            <Slider
              aria-label="Posición del video"
              value={Math.min(time, duration)}
              min={0}
              max={duration > 0 ? duration : 1}
              step={0.1}
              disabled={duration === 0}
              onChange={seek}
            />
            <span className="videos__time">{formatDuration(duration)}</span>
          </div>
          <div className="videos__buttons">
            <div className="videos__group">
              <IconButton label="Video anterior" disabled={!hasPrevious} onClick={() => go(-1)}>
                <SkipBack size={16} />
              </IconButton>
              <IconButton label={playing ? 'Pausar' : 'Reproducir'} disabled={url === null} onClick={togglePlay}>
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </IconButton>
              <IconButton label="Video siguiente" disabled={!hasNext} onClick={() => go(1)}>
                <SkipForward size={16} />
              </IconButton>
            </div>
            <span className="videos__title">{name === null ? '' : titleOf(name)}</span>
            <div className="videos__group">
              <IconButton
                label={prefs.muted ? 'Activar sonido' : 'Silenciar'}
                onClick={() => updatePrefs({ muted: !prefs.muted })}
              >
                <VolumeIcon size={16} />
              </IconButton>
              <div className="videos__volume">
                <Slider
                  aria-label="Volumen del video"
                  value={prefs.muted ? 0 : Math.round(prefs.volume * 100)}
                  onChange={(value) => updatePrefs({ volume: value / 100, muted: false })}
                />
              </div>
              {videos.length > 1 ? (
                <IconButton
                  label="Lista de videos de la carpeta"
                  active={playlistOpen}
                  onClick={() => setPlaylistOpen((value) => !value)}
                >
                  <ListVideo size={16} />
                </IconButton>
              ) : null}
              <IconButton label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} onClick={toggleFullscreen}>
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </IconButton>
            </div>
          </div>
        </div>
      </div>

      {showPlaylist ? (
        <aside className="videos__playlist" aria-label="Videos de la carpeta">
          <ul className="videos__list">
            {videos.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  className="videos__item"
                  aria-current={node.name === name || undefined}
                  onClick={() => setPath(joinPath(folder, node.name))}
                >
                  <Video size={14} aria-hidden="true" />
                  <span className="videos__item-name">{titleOf(node.name)}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}
    </div>
  )
}
