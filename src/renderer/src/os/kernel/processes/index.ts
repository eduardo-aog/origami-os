import { createStore } from 'zustand/vanilla'
import { getApp } from '../apps'
import { osConfig } from '../config'
import { on } from '../events'

export interface ProcessInfo {
  pid: number
  name: string
  /** `null` en los procesos ficticios del sistema. */
  appId: string | null
  instanceId: string | null
  startedAt: number
  /** Uso de CPU simulado, en porcentaje con un decimal. */
  cpu: number
  /** Memoria simulada, en MB. */
  memoryMB: number
}

interface SystemProcessSpec {
  pid: number
  name: string
  cpuBase: number
  cpuSwing: number
  memoryMB: number
}

interface AppInstance {
  pid: number
  appId: string
  instanceId: string
  name: string
  startedAt: number
}

// Procesos ficticios que dan realismo al Administrador de tareas.
const SYSTEM_PROCESSES: readonly SystemProcessSpec[] = [
  { pid: 1, name: 'Núcleo', cpuBase: 1.2, cpuSwing: 0.8, memoryMB: 180 },
  { pid: 12, name: 'WindowServer', cpuBase: 3.5, cpuSwing: 2.5, memoryMB: 420 },
  { pid: 18, name: 'Dock', cpuBase: 0.6, cpuSwing: 0.5, memoryMB: 95 },
  { pid: 24, name: 'Servicios', cpuBase: 0.9, cpuSwing: 0.7, memoryMB: 140 },
  { pid: 31, name: 'Almacenamiento', cpuBase: 0.4, cpuSwing: 0.6, memoryMB: 110 },
  { pid: 37, name: 'Sonido', cpuBase: 0.3, cpuSwing: 0.3, memoryMB: 64 },
  { pid: 52, name: 'Programador', cpuBase: 0.1, cpuSwing: 0.2, memoryMB: 36 }
]

/** Memoria que el sistema reserva además de los procesos listados, en MB. */
const RESERVED_MEMORY_MB = 1800
const FIRST_APP_PID = 1000

const store = createStore<{ instances: readonly AppInstance[] }>(() => ({ instances: [] }))
const bootedAt = Date.now()
let nextPid = FIRST_APP_PID
let initialized = false

/** Hash estable de un texto: la misma app siempre tiene la misma "personalidad". */
function hash(text: string): number {
  let value = 2166136261
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619)
  return value >>> 0
}

/** Onda suave y determinista entre 0 y 1. */
function wave(seed: number, timeMs: number, periodSeconds: number): number {
  const t = timeMs / 1000 / periodSeconds + (seed % 997) / 997
  return (Math.sin(t * 2 * Math.PI) + 0.5 * Math.sin(t * 5.3 * Math.PI + seed)) / 3 + 0.5
}

const round1 = (n: number) => Math.round(n * 10) / 10

function systemProcess(spec: SystemProcessSpec, now: number): ProcessInfo {
  return {
    pid: spec.pid,
    name: spec.name,
    appId: null,
    instanceId: null,
    startedAt: bootedAt,
    cpu: round1(Math.max(0, spec.cpuBase + (wave(spec.pid, now, 11) - 0.5) * 2 * spec.cpuSwing)),
    memoryMB: Math.round(spec.memoryMB * (0.97 + wave(spec.pid, now, 90) * 0.06))
  }
}

function appProcess(instance: AppInstance, now: number): ProcessInfo {
  const seed = hash(instance.appId)
  const baseMemory = 70 + (seed % 230)
  const ageSeconds = (now - instance.startedAt) / 1000
  return {
    pid: instance.pid,
    name: instance.name,
    appId: instance.appId,
    instanceId: instance.instanceId,
    startedAt: instance.startedAt,
    cpu: round1(Math.max(0.1, 0.4 + wave(instance.pid, now, 7) * (1 + (seed % 5)))),
    memoryMB: Math.round(baseMemory * (1 + Math.min(ageSeconds / 600, 0.25)) * (0.97 + wave(seed, now, 60) * 0.06))
  }
}

export const processes = {
  /** Empieza a seguir `app:launched` y `app:terminated`. Es seguro llamarla varias veces. */
  init(): void {
    if (initialized) return
    initialized = true
    on('app:launched', ({ appId, instanceId }) => {
      const instance: AppInstance = {
        pid: nextPid++,
        appId,
        instanceId,
        name: getApp(appId)?.manifest.name ?? appId,
        startedAt: Date.now()
      }
      store.setState((state) => ({ instances: [...state.instances, instance] }))
    })
    on('app:terminated', ({ instanceId }) => {
      store.setState((state) => ({
        instances: state.instances.filter((instance) => instance.instanceId !== instanceId)
      }))
    })
  },

  /** Procesos del sistema y de las apps abiertas, con las métricas simuladas del instante `now`. */
  list(now = Date.now()): ProcessInfo[] {
    return [
      ...SYSTEM_PROCESSES.map((spec) => systemProcess(spec, now)),
      ...store.getState().instances.map((instance) => appProcess(instance, now))
    ]
  },

  /** Totales del sistema: CPU en porcentaje y memoria usada y total en MB. */
  stats(now = Date.now()): { cpu: number; memoryUsedMB: number; memoryTotalMB: number } {
    const list = processes.list(now)
    const memoryTotalMB = osConfig.simulatedMemoryMB
    return {
      cpu: round1(Math.min(100, list.reduce((sum, p) => sum + p.cpu, 0))),
      memoryUsedMB: Math.min(memoryTotalMB, RESERVED_MEMORY_MB + list.reduce((sum, p) => sum + p.memoryMB, 0)),
      memoryTotalMB
    }
  },

  /** Avisa cuando se abre o se cierra una instancia de app. */
  subscribe(listener: () => void): () => void {
    return store.subscribe(() => listener())
  }
}
