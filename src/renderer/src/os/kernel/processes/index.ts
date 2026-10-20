import { getApp } from '../apps'
import { osConfig } from '../config'
import { on } from '../events'
import { notifications } from '../notifications'
import { SYSTEM_DISK_MB, getFilesMB, watchDisk } from './disk'
import * as engine from './engine'
import {
  SYSTEM_PROCESSES,
  appGenerator,
  driverGenerator,
  hash,
  labGenerators,
  testGenerator,
  testName,
  withStartDelay,
  type TestProfile
} from './profiles'
import { syncResources } from './resources'
import type { SystemSnapshot } from './types'

export { TEST_LABELS } from './profiles'
export type { TestProfile } from './profiles'
export type {
  DeadlockInfo,
  DiskInfo,
  ProcessInfo,
  ProcessKind,
  ProcessState,
  SyncResourceInfo,
  SystemSnapshot,
  Transition
} from './types'

/** Memoria que el sistema reserva además de los procesos listados, en MB. */
const RESERVED_MEMORY_MB = 3500
const FIRST_PID = 1000
/** Duración de un tick a velocidad 1x. */
const TICK_MS = 500
const HISTORY_SECONDS = 60
const MAX_TEST_PROCESSES = 12
const NOTIFICATION_APP = 'task-manager'

export const SPEEDS = [1, 2, 4] as const

const listeners = new Set<() => void>()
const history = { cpu: [] as number[], memory: [] as number[], disk: [] as number[] }
let nextPid = FIRST_PID
let testCount = 0
let paused = false
let speed = 1
let tickTimer: ReturnType<typeof setInterval> | undefined
let initialized = false
let snapshot: SystemSnapshot | null = null
let announcedDeadlock = false

const pushSample = (series: number[], value: number) => {
  series.push(value)
  if (series.length > HISTORY_SECONDS) series.shift()
}

/** Siempre `HISTORY_SECONDS` valores; si aún hay poca historia se rellena por la izquierda con la muestra más antigua. */
const padded = (series: number[]) =>
  series.length === 0
    ? Array.from({ length: HISTORY_SECONDS }, () => 0)
    : [...Array.from({ length: HISTORY_SECONDS - series.length }, () => series[0] ?? 0), ...series]

function build(): SystemSnapshot {
  const state = engine.readState(Date.now())
  const cycle = engine.findDeadlock()
  const memoryTotalMB = osConfig.simulatedMemoryMB
  const filesMB = Math.round(getFilesMB())
  return {
    tick: state.tick,
    paused,
    speed,
    cores: engine.CORES,
    quantumTicks: engine.QUANTUM_TICKS,
    processes: state.processes,
    readyQueue: state.readyQueue,
    coreSlots: state.coreSlots,
    resources: syncResources.info(engine.nameOf),
    transitions: state.transitions,
    deadlock: cycle ? { pids: cycle, names: cycle.map(engine.nameOf) } : null,
    labActive: engine.hasKey('lab:a') || engine.hasKey('lab:b'),
    cpu: state.cpu,
    memoryUsedMB: Math.min(memoryTotalMB, RESERVED_MEMORY_MB + state.memoryProcessesMB),
    memoryTotalMB,
    disk: {
      totalMB: osConfig.simulatedDiskMB,
      usedMB: Math.min(osConfig.simulatedDiskMB, SYSTEM_DISK_MB + filesMB),
      filesMB,
      readMBps: state.diskReadMBps,
      writeMBps: state.diskWriteMBps
    },
    history: { cpu: padded(history.cpu), memory: padded(history.memory), disk: padded(history.disk) }
  }
}

function refresh(): void {
  snapshot = build()
  const deadlocked = snapshot.deadlock !== null
  if (deadlocked && !announcedDeadlock) {
    notifications.post({
      appId: NOTIFICATION_APP,
      title: 'Interbloqueo detectado',
      body: snapshot.deadlock?.names.join(' y '),
      launchArgs: { section: 'sync' }
    })
  }
  announcedDeadlock = deadlocked
  for (const listener of [...listeners]) listener()
}

function restartTimer(): void {
  clearInterval(tickTimer)
  tickTimer = undefined
  if (paused) return
  tickTimer = setInterval(() => {
    engine.tick()
    refresh()
  }, TICK_MS / speed)
}

function sample(): void {
  if (!snapshot) return
  pushSample(history.cpu, snapshot.cpu)
  pushSample(history.memory, snapshot.memoryUsedMB)
  pushSample(history.disk, snapshot.disk.readMBps + snapshot.disk.writeMBps)
  refresh()
}

function spawnApp(appId: string, instanceId: string): void {
  const app = getApp(appId)
  const seed = hash(appId)
  engine.spawn({
    pid: nextPid++,
    name: app?.manifest.name ?? appId,
    kind: 'app',
    appId,
    instanceId,
    key: `instance:${instanceId}`,
    baseMemoryMB: 70 + (seed % 230),
    grows: true,
    generate: appGenerator(app?.manifest.category, seed)
  })
}

export const processes = {
  /** Arranca el planificador y empieza a seguir las apps y los periféricos. Es seguro llamarla varias veces. */
  init(): void {
    if (initialized) return
    initialized = true
    for (const spec of SYSTEM_PROCESSES) {
      engine.spawn({
        pid: spec.pid,
        name: spec.name,
        kind: 'system',
        baseMemoryMB: spec.memoryMB,
        generate: withStartDelay(spec.generate)
      })
    }
    on('app:launched', ({ appId, instanceId }) => {
      spawnApp(appId, instanceId)
      refresh()
    })
    on('app:terminated', ({ instanceId }) => {
      engine.terminateByKey(`instance:${instanceId}`, 'La aplicación se cerró')
      refresh()
    })
    on('peripheral:connected', ({ id, name }) => {
      engine.spawn({
        pid: nextPid++,
        name: `Controlador: ${name}`,
        kind: 'driver',
        key: `device:${id}`,
        baseMemoryMB: 24 + (hash(id) % 24),
        generate: driverGenerator
      })
      refresh()
    })
    on('peripheral:disconnected', ({ id }) => {
      engine.terminateByKey(`device:${id}`, 'El dispositivo se desconectó')
      refresh()
    })
    watchDisk(refresh)
    refresh()
    restartTimer()
    setInterval(sample, 1000)
  },

  /** Estado completo de la simulación; el objeto cambia en cada tick, así que sirve para `useSyncExternalStore`. */
  getSnapshot(): SystemSnapshot {
    snapshot ??= build()
    return snapshot
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },

  setPaused(value: boolean): void {
    paused = value
    restartTimer()
    refresh()
  },

  setSpeed(value: number): void {
    speed = value
    restartTimer()
    refresh()
  },

  /** Avanza un solo tick con la simulación en pausa. */
  step(): void {
    engine.tick()
    refresh()
  },

  /** Crea un proceso de prueba para ver cómo se reparte la CPU. Devuelve `false` si ya hay demasiados. */
  spawnTest(profile: TestProfile): boolean {
    if (engine.countKind('test') >= MAX_TEST_PROCESSES) return false
    testCount++
    engine.spawn({
      pid: nextPid++,
      name: testName(profile, testCount),
      kind: 'test',
      baseMemoryMB: 24,
      generate: testGenerator(profile)
    })
    refresh()
    return true
  },

  /** Termina un proceso de prueba o un hilo del laboratorio. Los demás procesos no se pueden terminar desde aquí. */
  terminateTest(pid: number): void {
    if (engine.kindOf(pid) !== 'test') return
    engine.terminate(pid, 'Terminado por el usuario')
    refresh()
  },

  /** Crea los dos hilos que se piden los recursos A y B en orden contrario. */
  startDeadlockLab(): void {
    for (const side of ['a', 'b'] as const) {
      if (engine.hasKey(`lab:${side}`)) continue
      engine.spawn({
        pid: nextPid++,
        name: `Hilo ${side.toUpperCase()}`,
        kind: 'test',
        key: `lab:${side}`,
        baseMemoryMB: 12,
        generate: labGenerators[side]
      })
    }
    refresh()
  },

  stopDeadlockLab(): void {
    engine.terminateByKey('lab:a', 'Laboratorio detenido')
    engine.terminateByKey('lab:b', 'Laboratorio detenido')
    refresh()
  },

  /** Rompe el interbloqueo terminando a uno de los procesos del ciclo; el otro recibe su recurso y sigue. */
  resolveDeadlock(): void {
    const cycle = engine.findDeadlock()
    const victim = cycle ? Math.max(...cycle) : undefined
    if (victim === undefined) return
    engine.terminate(victim, 'Terminado para romper el interbloqueo')
    refresh()
  }
}
