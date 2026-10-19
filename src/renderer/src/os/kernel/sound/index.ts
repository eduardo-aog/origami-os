import { settings } from '../settings'
import { playSynth } from './synth'
import { ALWAYS_AUDIBLE, type SystemSound } from './types'

export { SYSTEM_SOUNDS, type SystemSound } from './types'

// Archivos opcionales system/sounds/<nombre>.{mp3,ogg,wav}. Si no existen, se sintetiza el sonido.
const soundFiles = import.meta.glob<string>('/src/system/sounds/*.{mp3,ogg,wav}', {
  eager: true,
  import: 'default',
  query: '?url'
})

function findSoundFile(name: SystemSound): string | undefined {
  for (const extension of ['mp3', 'ogg', 'wav']) {
    const url = soundFiles[`/src/system/sounds/${name}.${extension}`]
    if (url !== undefined) return url
  }
  return undefined
}

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  audioContext ??= new AudioContext()
  if (audioContext.state === 'suspended') void audioContext.resume()
  return audioContext
}

/** Volumen efectivo del sistema entre 0 y 1; ya considera "silenciado". */
function getVolume(): number {
  return settings.get('sound.muted') ? 0 : settings.get('sound.volume') / 100
}

function synthesize(name: SystemSound, volume: number): void {
  try {
    playSynth(getAudioContext(), name, volume)
  } catch (error) {
    console.warn(`[sonido] No se pudo reproducir "${name}":`, error)
  }
}

export const sound = {
  play(name: SystemSound): void {
    if (!settings.get('sound.systemSounds') && !ALWAYS_AUDIBLE.includes(name)) return
    const volume = getVolume()
    if (volume === 0) return

    const file = findSoundFile(name)
    if (file === undefined) {
      synthesize(name, volume)
      return
    }
    const audio = new Audio(file)
    audio.volume = volume
    audio.play().catch(() => synthesize(name, volume))
  },

  getVolume,

  /** Avisa cuando cambia el volumen efectivo (volumen o silencio). */
  subscribeVolume(listener: (volume: number) => void): () => void {
    const notify = () => listener(getVolume())
    const stopVolume = settings.subscribe('sound.volume', notify)
    const stopMuted = settings.subscribe('sound.muted', notify)
    return () => {
      stopVolume()
      stopMuted()
    }
  }
}
