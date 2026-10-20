import type { AppCategory } from '../apps'
import type { IoDevice, Step } from './types'

export const IO_LABELS: Record<IoDevice, string> = {
  disk: 'Disco',
  audio: 'Dispositivo de audio',
  video: 'Tarjeta de video',
  timer: 'Temporizador',
  device: 'Interrupción del dispositivo'
}

export type Generator = () => Step[]

const rand = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))
const cpu = (min: number, max = min): Step => ({ op: 'cpu', ticks: rand(min, max) })
const sleep = (min: number, max = min): Step => ({ op: 'io', device: 'timer', ticks: rand(min, max) })
const disk = (min: number, max = min): Step => ({
  op: 'io',
  device: 'disk',
  ticks: rand(min, max),
  mode: Math.random() < 0.6 ? 'read' : 'write'
})
const acquire = (resource: Extract<Step, { op: 'acquire' }>['resource']): Step => ({ op: 'acquire', resource })
const release = (resource: Extract<Step, { op: 'release' }>['resource']): Step => ({ op: 'release', resource })

/** Hash estable de un texto: la misma app siempre tiene la misma "personalidad". */
export function hash(text: string): number {
  let value = 2166136261
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619)
  return value >>> 0
}

/** Onda suave y determinista entre 0 y 1, usada para que la memoria oscile un poco. */
export function wave(seed: number, timeMs: number, periodSeconds: number): number {
  const t = timeMs / 1000 / periodSeconds + (seed % 997) / 997
  return (Math.sin(t * 2 * Math.PI) + 0.5 * Math.sin(t * 5.3 * Math.PI + seed)) / 3 + 0.5
}

export interface SystemProcessSpec {
  pid: number
  name: string
  memoryMB: number
  generate: Generator
}

/** Procesos ficticios que existen desde el arranque. Casi todo el tiempo duermen o esperan E/S. */
export const SYSTEM_PROCESSES: readonly SystemProcessSpec[] = [
  { pid: 1, name: 'Núcleo', memoryMB: 180, generate: () => [cpu(1), sleep(8, 16)] },
  {
    pid: 12,
    name: 'WindowServer',
    memoryMB: 420,
    generate: () => [acquire('frame-buffer'), cpu(1, 2), release('frame-buffer'), sleep(8, 18)]
  },
  { pid: 18, name: 'Dock', memoryMB: 95, generate: () => [cpu(1), sleep(14, 30)] },
  { pid: 24, name: 'Servicios', memoryMB: 140, generate: () => [cpu(1), sleep(10, 24)] },
  {
    pid: 31,
    name: 'Almacenamiento',
    memoryMB: 110,
    generate: () => [acquire('disk-bus'), disk(1, 3), release('disk-bus'), cpu(1), sleep(10, 24)]
  },
  {
    pid: 37,
    name: 'Sonido',
    memoryMB: 64,
    generate: () => [acquire('audio-mixer'), cpu(1), { op: 'io', device: 'audio', ticks: rand(1, 3) }, release('audio-mixer'), sleep(14, 30)]
  },
  { pid: 52, name: 'Programador', memoryMB: 36, generate: () => [cpu(1), sleep(20, 40)] }
]

/** El primer paso de un proceso del sistema es dormir un rato, para que no arranquen todos a la vez. */
export const withStartDelay = (generate: Generator): Generator => {
  let first = true
  return () => {
    if (!first) return generate()
    first = false
    return [sleep(1, 14), ...generate()]
  }
}

/** Comportamiento de una app según su categoría; el `seed` de la app escala las pausas. */
export function appGenerator(category: AppCategory | undefined, seed: number): Generator {
  const pause = 0.7 + (seed % 60) / 100
  const wait = (min: number, max: number) => sleep(Math.round(min * pause), Math.round(max * pause))
  switch (category) {
    case 'multimedia':
      return () => [
        acquire('frame-buffer'),
        cpu(2, 4),
        release('frame-buffer'),
        acquire('audio-mixer'),
        cpu(1),
        { op: 'io', device: 'audio', ticks: rand(2, 4) },
        release('audio-mixer'),
        wait(1, 3)
      ]
    case 'productividad':
      return () => [cpu(1, 3), acquire('disk-bus'), disk(1, 2), release('disk-bus'), cpu(1), wait(4, 10)]
    case 'sistema':
      return () => [cpu(1, 2), acquire('disk-bus'), disk(1, 2), release('disk-bus'), wait(5, 12)]
    default:
      return () => [cpu(1, 2), wait(5, 12)]
  }
}

/** Un controlador pasa casi todo el tiempo esperando la interrupción de su dispositivo. */
export const driverGenerator: Generator = () => [{ op: 'io', device: 'device', ticks: rand(6, 16) }, cpu(1)]

export type TestProfile = 'cpu' | 'io' | 'mixed'

export const TEST_LABELS: Record<TestProfile, string> = {
  cpu: 'Intensivo en CPU',
  io: 'Intensivo en E/S',
  mixed: 'Mixto'
}

const TEST_NAMES: Record<TestProfile, string> = { cpu: 'Prueba CPU', io: 'Prueba E/S', mixed: 'Prueba mixta' }
export const testName = (profile: TestProfile, number: number) => `${TEST_NAMES[profile]} ${number}`

export function testGenerator(profile: TestProfile): Generator {
  switch (profile) {
    case 'cpu':
      return () => [cpu(10, 14), sleep(1)]
    case 'io':
      return () => [cpu(1), acquire('disk-bus'), { op: 'io', device: 'disk', ticks: 3, mode: 'write' }, release('disk-bus')]
    case 'mixed':
      return () => [cpu(3, 5), acquire('frame-buffer'), cpu(1), release('frame-buffer'), sleep(2, 4)]
  }
}

/**
 * Dos hilos que piden dos recursos en orden contrario. Cada uno duerme con el primero en la mano,
 * así que el otro tiene tiempo de tomar el suyo y ambos acaban esperándose: un interbloqueo.
 */
export const labGenerators = {
  a: (): Step[] => [acquire('lab-a'), sleep(2), acquire('lab-b'), cpu(1), release('lab-b'), release('lab-a'), sleep(4)],
  b: (): Step[] => [acquire('lab-b'), sleep(2), acquire('lab-a'), cpu(1), release('lab-a'), release('lab-b'), sleep(4)]
}
