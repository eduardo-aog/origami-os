import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import {
  AudioLines,
  FolderOpen,
  Library,
  ListMusic,
  ListPlus,
  Music as MusicIcon,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
  X
} from 'lucide-react'
import {
  Button,
  EmptyState,
  IconButton,
  Sidebar,
  Slider,
  TextField,
  formatDuration,
  useContextMenu,
  useFsObjectUrl,
  type MenuItem
} from '@os/ui'
import { useAppMenus, useLaunchArgs, useOpenFileHandler, useOS, useSystemVolume, type AppMenu } from '@os/sdk'
import { AUDIO_EXTENSIONS, filterTracks, scanLibrary, trackFromPath, type Track } from './library'
import { nextPosition, type PlaybackMode, type RepeatMode } from './queue'
import './music.css'

type Section = 'library' | 'queue'

interface Queue {
  tracks: Track[]
  /** Posición de la pista actual; `-1` si todavía no suena ninguna. */
  index: number
}

interface Prefs extends PlaybackMode {
  volume: number
}

const PREFS_KEY = 'prefs'
const DEFAULT_PREFS: Prefs = { volume: 0.8, shuffle: false, repeat: 'off' }
const RESTART_THRESHOLD_S = 3
const REPEAT_ORDER: RepeatMode[] = ['off', 'all', 'one']
const REPEAT_LABEL: Record<RepeatMode, string> = {
  off: 'Repetir: desactivado',
  all: 'Repetir: toda la cola',
  one: 'Repetir: esta pista'
}

const EMPTY_QUEUE: Queue = { tracks: [], index: -1 }

export default function App() {
  const os = useOS()
  const { fs, dialogs } = os
  const args = useLaunchArgs()
  const initialFile = typeof args.filePath === 'string' ? args.filePath : null
  const systemVolume = useSystemVolume()

  const [section, setSection] = useState<Section>('library')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [library, setLibrary] = useState<{ tracks: Track[]; loaded: boolean }>({ tracks: [], loaded: false })
  const [queue, setQueue] = useState<Queue>(EMPTY_QUEUE)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [autoplay, setAutoplay] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [failed, setFailed] = useState<string | null>(null)

  const root = useRef<HTMLDivElement>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const libraryTracks = useRef<Track[]>([])
  const played = useRef(new Set<number>())
  const history = useRef<number[]>([])
  const menu = useContextMenu()

  const current = queue.tracks[queue.index] ?? null
  const { url, error: loadError } = useFsObjectUrl(current?.path ?? null)
  const visible = useMemo(() => filterTracks(library.tracks, search), [library.tracks, search])

  useEffect(() => {
    root.current?.focus()
  }, [])

  useEffect(() => {
    libraryTracks.current = library.tracks
  }, [library.tracks])

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
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const scan = () =>
      scanLibrary(fs).then((tracks) => {
        if (active) setLibrary({ tracks, loaded: true })
      })
    void scan()
    const stop = os.events.on('fs:changed', () => {
      clearTimeout(timer)
      timer = setTimeout(() => void scan(), 300)
    })
    return () => {
      active = false
      clearTimeout(timer)
      stop()
    }
  }, [fs, os.events])

  useEffect(() => {
    const element = audio.current
    if (element) element.volume = Math.min(1, Math.max(0, prefs.volume * systemVolume))
  }, [prefs.volume, systemVolume, url])

  useEffect(() => {
    os.window.setTitle(current === null ? os.app.manifest.name : `${current.title} — ${os.app.manifest.name}`)
  }, [os.window, os.app.manifest.name, current])

  const startQueue = useCallback((tracks: Track[], index: number) => {
    played.current = new Set([index])
    history.current = []
    setQueue({ tracks, index })
    setAutoplay(true)
    setFailed(null)
    setTime(0)
    setDuration(0)
  }, [])

  const openPath = useCallback(
    (path: string, tracks: Track[]) => {
      const index = tracks.findIndex((track) => track.path === path)
      if (index === -1) startQueue([trackFromPath(path)], 0)
      else startQueue(tracks, index)
    },
    [startQueue]
  )

  useOpenFileHandler(useCallback((path: string) => openPath(path, libraryTracks.current), [openPath]))

  useEffect(() => {
    if (initialFile === null) return
    let active = true
    void scanLibrary(fs).then((tracks) => {
      if (active) openPath(initialFile, tracks)
    })
    return () => {
      active = false
    }
  }, [fs, initialFile, openPath])

  function updatePrefs(patch: Partial<Prefs>) {
    const next = { ...prefs, ...patch }
    setPrefs(next)
    void os.storage.set(PREFS_KEY, next)
  }

  function jumpTo(position: number) {
    if (queue.index !== -1) history.current.push(queue.index)
    played.current.add(position)
    setQueue({ ...queue, index: position })
    setAutoplay(true)
    setFailed(null)
    setTime(0)
    setDuration(0)
  }

  function restart() {
    const element = audio.current
    if (!element) return
    element.currentTime = 0
    void element.play().catch(() => undefined)
  }

  function playNext(auto: boolean) {
    const position = nextPosition(queue.tracks.length, queue.index, prefs, auto, played.current)
    if (position === null) return
    if (position === queue.index) restart()
    else jumpTo(position)
  }

  function playPrevious() {
    if (time > RESTART_THRESHOLD_S) {
      restart()
      return
    }
    const position = prefs.shuffle ? history.current.pop() : queue.index > 0 ? queue.index - 1 : undefined
    if (position === undefined || position === queue.index) {
      restart()
      return
    }
    played.current.add(position)
    setQueue({ ...queue, index: position })
    setAutoplay(true)
    setFailed(null)
    setTime(0)
    setDuration(0)
  }

  function togglePlay() {
    const element = audio.current
    if (current === null) {
      const first = visible[0]
      if (first) startQueue(visible, 0)
      return
    }
    if (!element) return
    if (element.paused) void element.play().catch(() => setFailed(`No se puede reproducir «${current.title}».`))
    else element.pause()
  }

  function enqueue(track: Track) {
    setQueue((previous) => ({ ...previous, tracks: [...previous.tracks, track] }))
  }

  function removeFromQueue(position: number) {
    if (position === queue.index) return
    played.current = new Set(queue.index === -1 ? [] : [queue.index > position ? queue.index - 1 : queue.index])
    history.current = []
    setQueue({
      tracks: queue.tracks.filter((_, at) => at !== position),
      index: queue.index > position ? queue.index - 1 : queue.index
    })
  }

  async function pickFile() {
    const picked = await dialogs.openFile({ startPath: '~/Música', extensions: AUDIO_EXTENSIONS })
    const target = picked?.[0]
    if (target !== undefined) openPath(target, libraryTracks.current)
    root.current?.focus()
  }

  const menus: AppMenu[] = [
    {
      label: 'Archivo',
      items: [{ label: 'Abrir…', shortcut: 'Ctrl+O', onSelect: () => void pickFile() }]
    },
    {
      label: 'Control',
      items: [
        { label: playing ? 'Pausar' : 'Reproducir', shortcut: 'Espacio', onSelect: togglePlay },
        { label: 'Pista anterior', shortcut: 'Ctrl+←', disabled: current === null, onSelect: playPrevious },
        { label: 'Pista siguiente', shortcut: 'Ctrl+→', disabled: queue.tracks.length === 0, onSelect: () => playNext(false) },
        { separator: true },
        { label: 'Aleatorio', checked: prefs.shuffle, onSelect: () => updatePrefs({ shuffle: !prefs.shuffle }) },
        {
          label: 'Repetir',
          submenu: REPEAT_ORDER.map((mode) => ({
            label: { off: 'Desactivado', all: 'Toda la cola', one: 'Esta pista' }[mode],
            checked: prefs.repeat === mode,
            onSelect: () => updatePrefs({ repeat: mode })
          }))
        }
      ]
    }
  ]
  useAppMenus(menus)

  function onKeyDown(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement && event.target.type !== 'range') return
    const mod = event.ctrlKey || event.metaKey
    if (event.key === ' ' && !mod) {
      event.preventDefault()
      togglePlay()
    } else if (mod && event.key === 'ArrowRight') {
      event.preventDefault()
      playNext(false)
    } else if (mod && event.key === 'ArrowLeft') {
      event.preventDefault()
      playPrevious()
    } else if (mod && event.key.toLowerCase() === 'o') {
      event.preventDefault()
      void pickFile()
    }
  }

  function rowMenu(event: { clientX: number; clientY: number; preventDefault(): void }, track: Track, play: () => void) {
    const items: MenuItem[] = [
      { label: 'Reproducir', onSelect: play },
      { label: 'Añadir a la cola', onSelect: () => enqueue(track) }
    ]
    menu.show(event, items)
  }

  const message = failed ?? loadError
  const VolumeIcon = prefs.volume === 0 || systemVolume === 0 ? VolumeX : prefs.volume < 0.5 ? Volume1 : Volume2
  const RepeatIcon = prefs.repeat === 'one' ? Repeat1 : Repeat

  return (
    <div ref={root} className="music" tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="music__body">
        <Sidebar
          aria-label="Secciones"
          selected={section}
          onSelect={(id) => setSection(id as Section)}
          items={[
            { id: 'library', label: 'Biblioteca', icon: <Library size={16} /> },
            { id: 'queue', label: queue.tracks.length === 0 ? 'Cola' : `Cola (${queue.tracks.length})`, icon: <ListMusic size={16} /> }
          ]}
        />

        <section className="music__main" aria-label={section === 'library' ? 'Biblioteca' : 'Cola de reproducción'}>
          {section === 'library' ? (
            <>
              <div className="music__header">
                <TextField
                  className="music__search"
                  type="search"
                  aria-label="Buscar en la biblioteca"
                  placeholder="Buscar"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                <Button onClick={() => void pickFile()}>
                  <FolderOpen size={14} />
                  Abrir…
                </Button>
              </div>
              {library.loaded && library.tracks.length === 0 ? (
                <EmptyState
                  icon={<MusicIcon size={40} />}
                  title="Tu biblioteca está vacía"
                  description="Las canciones que guardes en la carpeta Música aparecerán aquí."
                />
              ) : library.loaded && visible.length === 0 ? (
                <EmptyState title="Sin resultados" description="Ninguna pista coincide con la búsqueda." />
              ) : (
                <ul className="music__list" aria-label="Pistas">
                  {visible.map((track, position) => (
                    <TrackRow
                      key={track.path}
                      track={track}
                      isCurrent={current?.path === track.path}
                      isPlaying={playing}
                      isSelected={selected === track.path}
                      onSelect={() => setSelected(track.path)}
                      onPlay={() => startQueue(visible, position)}
                      onEnqueue={() => enqueue(track)}
                      onContextMenu={(event) => rowMenu(event, track, () => startQueue(visible, position))}
                    />
                  ))}
                </ul>
              )}
            </>
          ) : queue.tracks.length === 0 ? (
            <EmptyState
              icon={<ListMusic size={40} />}
              title="La cola está vacía"
              description="Reproduce una pista de la biblioteca o añádela a la cola."
            />
          ) : (
            <ul className="music__list" aria-label="Cola de reproducción">
              {queue.tracks.map((track, position) => (
                <TrackRow
                  key={`${track.path}:${position}`}
                  track={track}
                  isCurrent={position === queue.index}
                  isPlaying={playing}
                  isSelected={false}
                  onSelect={() => undefined}
                  onPlay={() => jumpTo(position)}
                  onRemove={position === queue.index ? undefined : () => removeFromQueue(position)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <footer className="music__player">
        <div className="music__progress">
          <span className="music__time">{formatDuration(time)}</span>
          <Slider
            aria-label="Posición de la pista"
            value={Math.min(time, duration)}
            min={0}
            max={duration > 0 ? duration : 1}
            step={0.1}
            disabled={current === null || duration === 0}
            onChange={(value) => {
              if (audio.current) audio.current.currentTime = value
              setTime(value)
            }}
          />
          <span className="music__time">{formatDuration(duration)}</span>
        </div>
        <div className="music__controls">
          <div className="music__now" aria-live="polite">
            {current === null ? (
              <span className="music__now-title music__now-title--idle">Nada en reproducción</span>
            ) : (
              <>
                <span className="music__now-title">{current.title}</span>
                <span className={message === null ? 'music__now-subtitle' : 'music__now-subtitle music__now-subtitle--error'}>
                  {message ?? current.folder}
                </span>
              </>
            )}
          </div>
          <div className="music__transport">
            <IconButton label="Aleatorio" active={prefs.shuffle} onClick={() => updatePrefs({ shuffle: !prefs.shuffle })}>
              <Shuffle size={16} />
            </IconButton>
            <IconButton label="Pista anterior" disabled={current === null} onClick={playPrevious}>
              <SkipBack size={18} />
            </IconButton>
            <IconButton
              label={playing ? 'Pausar' : 'Reproducir'}
              className="music__play"
              disabled={current === null && visible.length === 0}
              onClick={togglePlay}
            >
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </IconButton>
            <IconButton label="Pista siguiente" disabled={queue.tracks.length === 0} onClick={() => playNext(false)}>
              <SkipForward size={18} />
            </IconButton>
            <IconButton
              label={REPEAT_LABEL[prefs.repeat]}
              active={prefs.repeat !== 'off'}
              onClick={() => updatePrefs({ repeat: REPEAT_ORDER[(REPEAT_ORDER.indexOf(prefs.repeat) + 1) % REPEAT_ORDER.length] ?? 'off' })}
            >
              <RepeatIcon size={16} />
            </IconButton>
          </div>
          <div className="music__volume">
            <VolumeIcon size={16} aria-hidden="true" />
            <Slider
              aria-label="Volumen"
              value={Math.round(prefs.volume * 100)}
              min={0}
              max={100}
              onChange={(value) => updatePrefs({ volume: value / 100 })}
            />
          </div>
        </div>
      </footer>

      <audio
        ref={audio}
        src={url ?? undefined}
        autoPlay={autoplay}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onDurationChange={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onEnded={() => playNext(true)}
        onError={() => setFailed(current === null ? null : `No se puede reproducir «${current.title}».`)}
      />
      {menu.menu}
    </div>
  )
}

interface TrackRowProps {
  track: Track
  isCurrent: boolean
  isPlaying: boolean
  isSelected: boolean
  onSelect: () => void
  onPlay: () => void
  onEnqueue?: () => void
  onRemove?: () => void
  onContextMenu?: (event: MouseEvent) => void
}

function TrackRow({ track, isCurrent, isPlaying, isSelected, onSelect, onPlay, onEnqueue, onRemove, onContextMenu }: TrackRowProps) {
  return (
    <li className="music__row" aria-current={isCurrent || undefined} aria-selected={isSelected || undefined}>
      <button
        type="button"
        className="music__row-main"
        onClick={onSelect}
        onDoubleClick={onPlay}
        onContextMenu={onContextMenu}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onPlay()
          }
        }}
      >
        <span className="music__row-icon">
          {isCurrent ? <AudioLines size={16} className={isPlaying ? 'music__bars' : undefined} /> : <MusicIcon size={16} />}
        </span>
        <span className="music__row-text">
          <span className="music__row-title">{track.title}</span>
          <span className="music__row-subtitle">{track.folder}</span>
        </span>
      </button>
      {onEnqueue ? (
        <IconButton label={`Añadir «${track.title}» a la cola`} onClick={onEnqueue}>
          <ListPlus size={16} />
        </IconButton>
      ) : null}
      {onRemove ? (
        <IconButton label={`Quitar «${track.title}» de la cola`} onClick={onRemove}>
          <X size={16} />
        </IconButton>
      ) : null}
    </li>
  )
}
