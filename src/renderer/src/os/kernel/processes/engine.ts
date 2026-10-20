import { osConfig } from '../config'
import { IO_LABELS, wave, type Generator } from './profiles'
import { syncResources } from './resources'
import type { IoDevice, ProcessInfo, ProcessKind, ProcessState, ResourceId, Step, Transition } from './types'

/** Ticks que dura el turno de un proceso antes de que lo expropien (planificación round-robin). */
export const QUANTUM_TICKS = 4
export const CORES = osConfig.simulatedCores
/** Ventana de ticks sobre la que se calcula el porcentaje de CPU. */
const CPU_WINDOW = 20
/** Ticks que un proceso terminado sigue visible en la lista. */
const LINGER_TICKS = 4
const MAX_TRANSITIONS = 200
/** Protege contra un programa de pasos sin duración que nunca cede la CPU. */
const MAX_INSTANT_STEPS = 64

interface Proc {
  pid: number
  name: string
  kind: ProcessKind
  appId: string | null
  instanceId: string | null
  /** Identifica a quien lo creó (`instance:<id>`, `device:<id>`, `lab:a`), para cerrarlo después. */
  key: string | null
  startedAt: number
  state: ProcessState
  core: number | null
  script: Step[]
  pc: number
  /** Ticks que le quedan al paso `cpu` o `io` en curso; 0 si todavía no empezó. */
  remaining: number
  quantumLeft: number
  next: Generator
  ioDevice: IoDevice | null
  ioMode: 'read' | 'write'
  waitingFor: string | null
  baseMemoryMB: number
  /** Las apps usan algo más de memoria cuanto más tiempo llevan abiertas. */
  grows: boolean
  recent: number[]
  runTicks: number
  readyTicks: number
  waitTicks: number
  linger: number
}

export interface SpawnSpec {
  pid: number
  name: string
  kind: ProcessKind
  appId?: string
  instanceId?: string
  key?: string
  baseMemoryMB: number
  grows?: boolean
  generate: Generator
}

const procs = new Map<number, Proc>()
const readyQueue: number[] = []
const coreSlots: (number | null)[] = Array.from({ length: CORES }, () => null)
const transitions: Transition[] = []
const busyRing: number[] = Array.from({ length: CPU_WINDOW }, () => 0)
let tickCount = 0
let transitionId = 1
let diskRead = 0
let diskWrite = 0

const round1 = (n: number) => Math.round(n * 10) / 10

function changeState(p: Proc, to: ProcessState, reason: string): void {
  transitions.unshift({
    id: transitionId++,
    tick: tickCount,
    at: Date.now(),
    pid: p.pid,
    name: p.name,
    from: p.state,
    to,
    reason
  })
  if (transitions.length > MAX_TRANSITIONS) transitions.pop()
  p.state = to
}

function leaveCore(p: Proc): void {
  if (p.core !== null) coreSlots[p.core] = null
  p.core = null
}

function makeReady(p: Proc, reason: string): void {
  changeState(p, 'ready', reason)
  p.waitingFor = null
  readyQueue.push(p.pid)
}

function block(p: Proc, reason: string, waitingFor: string): void {
  leaveCore(p)
  changeState(p, 'waiting', reason)
  p.waitingFor = waitingFor
}

const kindLabel = (id: ResourceId) => (syncResources.kindOf(id) === 'mutex' ? 'Mutex' : 'Semáforo')

/** Un proceso de la cola recibe el recurso que esperaba: deja de esperar y pasa a la cola de listos. */
function grant(pid: number, resource: ResourceId): void {
  const p = procs.get(pid)
  if (!p || p.state !== 'waiting') return
  p.pc++
  makeReady(p, `«${syncResources.name(resource)}» liberado`)
}

/**
 * Ejecuta los pasos que no consumen tiempo (pedir y liberar recursos) hasta llegar a uno que sí:
 * una ráfaga de CPU, que deja al proceso ejecutándose, o una E/S o una espera, que lo bloquean.
 */
function settle(p: Proc): void {
  for (let guard = 0; guard < MAX_INSTANT_STEPS; guard++) {
    if (p.pc >= p.script.length) {
      p.script = p.next()
      p.pc = 0
      p.remaining = 0
    }
    const step = p.script[p.pc]
    if (!step) return
    switch (step.op) {
      case 'cpu':
        if (p.remaining === 0) p.remaining = step.ticks
        return
      case 'io': {
        p.ioDevice = step.device
        p.ioMode = step.mode ?? 'read'
        p.remaining = step.ticks
        const label = IO_LABELS[step.device]
        block(
          p,
          step.device === 'timer' ? 'Se suspende un momento' : `Espera de E/S: ${label}`,
          step.device === 'timer' ? 'Suspendido (temporizador)' : `E/S: ${label}`
        )
        return
      }
      case 'acquire':
        if (syncResources.wait(step.resource, p.pid)) {
          p.pc++
          break
        }
        block(
          p,
          `Pide «${syncResources.name(step.resource)}», que está ocupado`,
          `${kindLabel(step.resource)} «${syncResources.name(step.resource)}»`
        )
        return
      case 'release': {
        p.pc++
        const next = syncResources.signal(step.resource, p.pid)
        if (next !== undefined) grant(next, step.resource)
        break
      }
    }
  }
  // Un programa sin pasos con duración: se le da una ráfaga mínima para que el sistema no se cuelgue.
  p.script = [{ op: 'cpu', ticks: 1 }]
  p.pc = 0
  p.remaining = 1
}

export function spawn(spec: SpawnSpec): void {
  const p: Proc = {
    pid: spec.pid,
    name: spec.name,
    kind: spec.kind,
    appId: spec.appId ?? null,
    instanceId: spec.instanceId ?? null,
    key: spec.key ?? null,
    startedAt: Date.now(),
    state: 'new',
    core: null,
    script: spec.generate(),
    pc: 0,
    remaining: 0,
    quantumLeft: 0,
    next: spec.generate,
    ioDevice: null,
    ioMode: 'read',
    waitingFor: null,
    baseMemoryMB: spec.baseMemoryMB,
    grows: spec.grows ?? false,
    recent: Array.from({ length: CPU_WINDOW }, () => 0),
    runTicks: 0,
    readyTicks: 0,
    waitTicks: 0,
    linger: 0
  }
  procs.set(p.pid, p)
  transitions.unshift({
    id: transitionId++,
    tick: tickCount,
    at: p.startedAt,
    pid: p.pid,
    name: p.name,
    from: null,
    to: 'new',
    reason: 'Proceso creado'
  })
}

export function terminate(pid: number, reason: string): void {
  const p = procs.get(pid)
  if (!p || p.state === 'terminated') return
  leaveCore(p)
  const queued = readyQueue.indexOf(pid)
  if (queued !== -1) readyQueue.splice(queued, 1)
  const woken = syncResources.purge(pid)
  p.ioDevice = null
  p.waitingFor = null
  changeState(p, 'terminated', reason)
  p.linger = LINGER_TICKS
  for (const { pid: waiter, resource } of woken) grant(waiter, resource)
}

export function terminateByKey(key: string, reason: string): void {
  for (const p of [...procs.values()]) if (p.key === key) terminate(p.pid, reason)
}

export function hasKey(key: string): boolean {
  return [...procs.values()].some((p) => p.key === key && p.state !== 'terminated')
}

export function countKind(kind: ProcessKind): number {
  return [...procs.values()].filter((p) => p.kind === kind && p.state !== 'terminated').length
}

export function kindOf(pid: number): ProcessKind | undefined {
  return procs.get(pid)?.kind
}

function afterRun(p: Proc): void {
  if (p.state !== 'running' || p.quantumLeft > 0) return
  // Solo se expropia si hay alguien esperando turno; si no, el proceso sigue con un quantum nuevo.
  if (readyQueue.length === 0) {
    p.quantumLeft = QUANTUM_TICKS
    return
  }
  leaveCore(p)
  makeReady(p, 'Quantum agotado (expropiado)')
}

/** Avanza la simulación un tick: E/S, admisión, despacho a los núcleos y ejecución. */
export function tick(): void {
  tickCount++
  const slot = tickCount % CPU_WINDOW
  for (const p of procs.values()) p.recent[slot] = 0

  // 1. Las operaciones de E/S avanzan; las que terminan devuelven el proceso a la cola de listos.
  for (const p of procs.values()) {
    if (p.state !== 'waiting' || p.ioDevice === null) continue
    p.remaining--
    if (p.remaining > 0) continue
    const device = p.ioDevice
    p.ioDevice = null
    p.remaining = 0
    p.pc++
    makeReady(p, device === 'timer' ? 'Temporizador vencido' : 'E/S completada')
  }

  // 2. Admisión: los procesos nuevos pasan a la cola de listos.
  for (const p of procs.values()) if (p.state === 'new') makeReady(p, 'Admitido por el planificador')

  // 3. Despacho: cada núcleo libre toma al primero de la cola de listos.
  for (let core = 0; core < CORES; core++) {
    while (coreSlots[core] === null) {
      const pid = readyQueue.shift()
      if (pid === undefined) break
      const p = procs.get(pid)
      if (!p || p.state !== 'ready') continue
      p.core = core
      coreSlots[core] = pid
      p.quantumLeft = QUANTUM_TICKS
      changeState(p, 'running', `Despachado al núcleo ${core + 1}`)
      settle(p)
    }
  }

  // 4. Ejecución: cada proceso en un núcleo consume un tick de su ráfaga.
  let busy = 0
  for (let core = 0; core < CORES; core++) {
    const pid = coreSlots[core]
    const p = pid === null || pid === undefined ? undefined : procs.get(pid)
    if (!p || p.state !== 'running') continue
    busy++
    p.runTicks++
    p.recent[slot] = 1
    p.remaining--
    p.quantumLeft--
    if (p.remaining <= 0) {
      p.pc++
      p.remaining = 0
      settle(p)
    }
    afterRun(p)
  }
  busyRing[slot] = busy

  // 5. Contabilidad.
  let read = 0
  let write = 0
  for (const p of [...procs.values()]) {
    if (p.state === 'ready') p.readyTicks++
    else if (p.state === 'waiting') {
      p.waitTicks++
      if (p.ioDevice === 'disk') {
        const rate = 18 + ((p.pid * 7) % 40)
        if (p.ioMode === 'read') read += rate
        else write += rate
      }
    } else if (p.state === 'terminated' && --p.linger <= 0) procs.delete(p.pid)
  }
  // La actividad del disco se suaviza para que la gráfica no salte entre 0 y el máximo.
  diskRead = diskRead * 0.5 + read * 0.5
  diskWrite = diskWrite * 0.5 + write * 0.5
}

/** Busca un ciclo en el grafo "quién espera a quién". Un ciclo es un interbloqueo. */
export function findDeadlock(): number[] | null {
  const waitsFor = new Map<number, number[]>()
  for (const p of procs.values()) {
    if (p.state !== 'waiting' || p.ioDevice !== null) continue
    const wanted = syncResources.of(p.pid, true)[0]
    if (wanted) waitsFor.set(p.pid, syncResources.holders(wanted).filter((holder) => holder !== p.pid))
  }
  const visited = new Set<number>()
  const search = (node: number, path: number[]): number[] | null => {
    const at = path.indexOf(node)
    if (at !== -1) return path.slice(at)
    if (visited.has(node)) return null
    visited.add(node)
    path.push(node)
    for (const next of waitsFor.get(node) ?? []) {
      const found = search(next, path)
      if (found) return found
    }
    path.pop()
    return null
  }
  for (const pid of waitsFor.keys()) {
    const cycle = search(pid, [])
    if (cycle) return cycle
  }
  return null
}

export function nameOf(pid: number): string {
  return procs.get(pid)?.name ?? `PID ${pid}`
}

function toInfo(p: Proc, now: number): ProcessInfo {
  const terminated = p.state === 'terminated'
  const age = (now - p.startedAt) / 1000
  const growth = p.grows ? 1 + Math.min(age / 600, 0.25) : 1
  return {
    pid: p.pid,
    name: p.name,
    appId: p.appId,
    instanceId: p.instanceId,
    kind: p.kind,
    state: p.state,
    core: p.core,
    waitingFor: p.waitingFor,
    holding: syncResources.of(p.pid).map((id) => syncResources.name(id)),
    startedAt: p.startedAt,
    cpu: round1((p.recent.reduce((sum, ran) => sum + ran, 0) / CPU_WINDOW / CORES) * 100),
    memoryMB: terminated ? 0 : Math.round(p.baseMemoryMB * growth * (0.97 + wave(p.pid, now, 60) * 0.06)),
    runTicks: p.runTicks,
    readyTicks: p.readyTicks,
    waitTicks: p.waitTicks
  }
}

export function readState(now: number) {
  const list = [...procs.values()].map((p) => toInfo(p, now))
  return {
    tick: tickCount,
    processes: list,
    readyQueue: [...readyQueue],
    coreSlots: [...coreSlots],
    transitions: [...transitions],
    cpu: round1((busyRing.reduce((sum, busy) => sum + busy, 0) / CPU_WINDOW / CORES) * 100),
    memoryProcessesMB: list.reduce((sum, p) => sum + p.memoryMB, 0),
    diskReadMBps: Math.round(diskRead),
    diskWriteMBps: Math.round(diskWrite)
  }
}
