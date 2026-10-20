/** Modelo clásico de cinco estados. */
export type ProcessState = 'new' | 'ready' | 'running' | 'waiting' | 'terminated'

export type ProcessKind = 'system' | 'app' | 'driver' | 'test'

export type IoDevice = 'disk' | 'audio' | 'video' | 'timer' | 'device'

export type ResourceId = 'disk-bus' | 'audio-mixer' | 'frame-buffer' | 'lab-a' | 'lab-b'

/** Un programa simulado es una lista de pasos que el planificador ejecuta de uno en uno. */
export type Step =
  | { op: 'cpu'; ticks: number }
  | { op: 'io'; device: IoDevice; ticks: number; mode?: 'read' | 'write' }
  | { op: 'acquire'; resource: ResourceId }
  | { op: 'release'; resource: ResourceId }

export interface ProcessInfo {
  pid: number
  name: string
  /** `null` en los procesos que no son una app. */
  appId: string | null
  instanceId: string | null
  kind: ProcessKind
  state: ProcessState
  /** Núcleo que lo ejecuta, solo en estado `running`. */
  core: number | null
  /** Motivo de la espera, solo en estado `waiting`. */
  waitingFor: string | null
  /** Nombres de los recursos de sincronización que posee. */
  holding: string[]
  startedAt: number
  /** Porcentaje de la CPU total que usó en los últimos segundos, con un decimal. */
  cpu: number
  /** Memoria simulada, en MB (0 cuando terminó). */
  memoryMB: number
  /** Ticks que pasó ejecutándose, listo y en espera desde que existe. */
  runTicks: number
  readyTicks: number
  waitTicks: number
}

export interface Transition {
  id: number
  tick: number
  at: number
  pid: number
  name: string
  /** `null` cuando el proceso se acaba de crear. */
  from: ProcessState | null
  to: ProcessState
  reason: string
}

export interface SyncResourceInfo {
  id: ResourceId
  name: string
  kind: 'mutex' | 'semaphore'
  capacity: number
  available: number
  holders: { pid: number; name: string }[]
  /** En orden de llegada: el primero es el próximo en recibirlo. */
  queue: { pid: number; name: string }[]
  /** Recursos del laboratorio de interbloqueo. */
  lab: boolean
}

export interface DeadlockInfo {
  /** Procesos del ciclo. */
  pids: number[]
  names: string[]
}

export interface DiskInfo {
  totalMB: number
  usedMB: number
  /** Parte de `usedMB` que corresponde a los archivos reales del sistema de archivos virtual. */
  filesMB: number
  readMBps: number
  writeMBps: number
}

export interface SystemSnapshot {
  tick: number
  paused: boolean
  speed: number
  cores: number
  quantumTicks: number
  processes: ProcessInfo[]
  /** PIDs en la cola de listos, el primero es el próximo en ejecutarse. */
  readyQueue: number[]
  /** PID que ejecuta cada núcleo, `null` si está libre. */
  coreSlots: (number | null)[]
  resources: SyncResourceInfo[]
  /** De la más reciente a la más antigua. */
  transitions: Transition[]
  deadlock: DeadlockInfo | null
  /** `true` mientras los hilos del laboratorio de interbloqueo existen. */
  labActive: boolean
  cpu: number
  memoryUsedMB: number
  memoryTotalMB: number
  disk: DiskInfo
  /** Una muestra por segundo, de la más antigua a la más reciente. */
  history: { cpu: number[]; memory: number[]; disk: number[] }
}
