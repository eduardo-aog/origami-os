import { getApp, type AppContext, type AppPermission } from '../apps'
import { emit, on } from '../events'

export type MediaErrorCode = 'permission' | 'denied' | 'not-found' | 'unavailable'

export class MediaError extends Error {
  readonly code: MediaErrorCode

  constructor(code: MediaErrorCode, message: string) {
    super(message)
    this.name = 'MediaError'
    this.code = code
  }
}

type MediaKind = 'camera' | 'microphone'

interface TrackedStream {
  stream: MediaStream
  instanceId: string
  kind: MediaKind
}

const tracked = new Set<TrackedStream>()
let lastReported = { camera: false, microphone: false }
let initialized = false

function requirePermission(context: AppContext, permission: Extract<AppPermission, MediaKind>): void {
  const permissions = getApp(context.appId)?.manifest.permissions ?? []
  if (!permissions.includes(permission)) {
    throw new MediaError('permission', `Esta app no tiene el permiso "${permission}" en su manifiesto.`)
  }
}

function reportIfChanged(): void {
  const active = {
    camera: [...tracked].some((entry) => entry.kind === 'camera'),
    microphone: [...tracked].some((entry) => entry.kind === 'microphone')
  }
  if (active.camera === lastReported.camera && active.microphone === lastReported.microphone) return
  lastReported = active
  emit('media:active', active)
}

function release(entry: TrackedStream): void {
  entry.stream.getTracks().forEach((track) => track.stop())
  tracked.delete(entry)
  reportIfChanged()
}

function track(stream: MediaStream, context: AppContext, kind: MediaKind): MediaStream {
  const entry: TrackedStream = { stream, instanceId: context.instanceId, kind }
  tracked.add(entry)
  const releaseIfEnded = () => {
    if (stream.getTracks().every((t) => t.readyState === 'ended')) {
      tracked.delete(entry)
      reportIfChanged()
    }
  }
  stream.getTracks().forEach((mediaTrack) => {
    mediaTrack.addEventListener('ended', releaseIfEnded)
    // `stop()` no dispara `ended`: sin esto el indicador seguiría encendido cuando la app detiene sus pistas.
    const stop = mediaTrack.stop.bind(mediaTrack)
    mediaTrack.stop = () => {
      stop()
      releaseIfEnded()
    }
  })
  reportIfChanged()
  return stream
}

function describeFailure(error: unknown, kind: MediaKind): MediaError {
  const label = kind === 'camera' ? 'la cámara' : 'el micrófono'
  const name = error instanceof DOMException ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new MediaError('denied', `Se denegó el acceso a ${label}.`)
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new MediaError('not-found', `No se encontró ${kind === 'camera' ? 'ninguna cámara' : 'ningún micrófono'}.`)
  }
  return new MediaError('unavailable', `No se pudo usar ${label}. Puede que otra aplicación la esté usando.`)
}

async function capture(context: AppContext, kind: MediaKind, constraints: MediaStreamConstraints): Promise<MediaStream> {
  requirePermission(context, kind)
  try {
    return track(await navigator.mediaDevices.getUserMedia(constraints), context, kind)
  } catch (error) {
    throw describeFailure(error, kind)
  }
}

export const media = {
  /** Detiene todos los streams de una instancia cuando esta termina. Es seguro llamarla varias veces. */
  init(): void {
    if (initialized) return
    initialized = true
    on('app:terminated', ({ instanceId }) => media.stopAll(instanceId))
  },

  getCamera(context: AppContext, constraints: MediaTrackConstraints = {}): Promise<MediaStream> {
    return capture(context, 'camera', { video: constraints })
  },

  getMicrophone(context: AppContext): Promise<MediaStream> {
    return capture(context, 'microphone', { audio: true })
  },

  async listCameras(context: AppContext): Promise<MediaDeviceInfo[]> {
    requirePermission(context, 'camera')
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices.filter((device) => device.kind === 'videoinput')
  },

  /** Detiene los streams de una instancia (o de todas si no se indica). */
  stopAll(instanceId?: string): void {
    for (const entry of [...tracked]) {
      if (instanceId === undefined || entry.instanceId === instanceId) release(entry)
    }
  },

  active(): { camera: boolean; microphone: boolean } {
    return { ...lastReported }
  }
}
