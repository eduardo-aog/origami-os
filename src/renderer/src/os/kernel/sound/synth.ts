import type { SystemSound } from './types'

/** Una nota o ruido dentro de la "receta" de un sonido. Los tiempos están en segundos. */
interface Tone {
  start: number
  duration: number
  gain: number
  /** Frecuencia en Hz (ignorada si `wave` es "noise"). */
  freq?: number
  /** Frecuencia final para un deslizamiento. */
  freqEnd?: number
  wave: OscillatorType | 'noise'
  /** Frecuencia de corte del filtro paso bajo (para el ruido). */
  cutoff?: number
}

const note = (start: number, duration: number, freq: number, gain = 0.2, wave: OscillatorType = 'sine'): Tone => ({
  start,
  duration,
  freq,
  gain,
  wave
})

const noise = (start: number, duration: number, cutoff: number, gain = 0.25): Tone => ({
  start,
  duration,
  gain,
  wave: 'noise',
  cutoff
})

const beeps = (from: number, count: number, freq: number): Tone[] =>
  Array.from({ length: count }, (_, i) => note(from + i * 0.3, 0.15, freq, 0.18, 'square'))

/** Sonidos del sistema generados con Web Audio cuando no existe un archivo en system/sounds/. */
const RECIPES: Record<SystemSound, Tone[]> = {
  boot: [
    note(0, 1.6, 130.81, 0.1),
    note(0, 1.1, 261.63, 0.18, 'triangle'),
    note(0.18, 1.1, 392, 0.16, 'triangle'),
    note(0.36, 1.1, 523.25, 0.14, 'triangle'),
    note(0.54, 1.1, 659.25, 0.12, 'triangle')
  ],
  login: [note(0, 0.3, 392, 0.2), note(0.12, 0.55, 523.25, 0.2), note(0.24, 0.6, 659.25, 0.14)],
  logout: [note(0, 0.3, 523.25, 0.2), note(0.14, 0.55, 392, 0.2)],
  shutdown: [note(0, 0.4, 659.25, 0.2), note(0.25, 0.4, 523.25, 0.2), note(0.5, 0.45, 392, 0.2), note(0.75, 0.9, 261.63, 0.2)],
  notification: [note(0, 0.14, 1318.5, 0.16, 'triangle'), note(0.1, 0.4, 987.77, 0.16, 'triangle')],
  error: [note(0, 0.13, 196, 0.12, 'square'), note(0.15, 0.25, 146.83, 0.12, 'square')],
  trash: [noise(0, 0.18, 1800), noise(0.1, 0.15, 900, 0.2)],
  'empty-trash': [noise(0, 0.5, 2400, 0.3), noise(0.2, 0.4, 1200, 0.22)],
  alarm: [...beeps(0, 4, 880), ...beeps(1.5, 4, 880)],
  shutter: [noise(0, 0.03, 4000, 0.35), noise(0.06, 0.05, 2500, 0.3)],
  lock: [note(0, 0.1, 330, 0.18), note(0.07, 0.14, 220, 0.18)]
}

function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate * 0.6)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/** Reproduce la receta de `name` con el volumen maestro indicado (0–1). */
export function playSynth(context: AudioContext, name: SystemSound, volume: number): void {
  const master = context.createGain()
  master.gain.value = Math.min(1, Math.max(0, volume))
  master.connect(context.destination)

  const base = context.currentTime + 0.02
  for (const tone of RECIPES[name]) {
    const start = base + tone.start
    const end = start + tone.duration
    const envelope = context.createGain()
    envelope.gain.setValueAtTime(0.0001, start)
    envelope.gain.exponentialRampToValueAtTime(tone.gain, start + Math.min(0.012, tone.duration / 3))
    envelope.gain.exponentialRampToValueAtTime(0.0001, end)

    let source: AudioScheduledSourceNode
    if (tone.wave === 'noise') {
      const buffered = context.createBufferSource()
      buffered.buffer = noiseBuffer(context)
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = tone.cutoff ?? 2000
      buffered.connect(filter)
      filter.connect(envelope)
      source = buffered
    } else {
      const oscillator = context.createOscillator()
      oscillator.type = tone.wave
      oscillator.frequency.setValueAtTime(tone.freq ?? 440, start)
      if (tone.freqEnd !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(tone.freqEnd, end)
      }
      oscillator.connect(envelope)
      source = oscillator
    }
    envelope.connect(master)
    source.start(start)
    source.stop(end + 0.05)
  }
}
