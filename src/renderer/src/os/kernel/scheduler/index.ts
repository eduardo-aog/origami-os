import { emit } from '../events'
import { notifications } from '../notifications'
import { sound } from '../sound'
import { storage, type ScheduledJob, type ScheduledRepeat } from '../storage'

export type { ScheduledJob, ScheduledRepeat } from '../storage'

export type NewJob = Omit<ScheduledJob, 'id' | 'appId'>

const TICK_MS = 1000

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6

/** Próximo disparo estrictamente posterior a `now`, conservando la hora del día. `null` si no se repite. */
function nextFireAt(job: ScheduledJob, now: number): number | null {
  if (job.repeat === 'none') return null
  const next = new Date(job.fireAt)
  do {
    next.setDate(next.getDate() + 1)
  } while (next.getTime() <= now || (job.repeat === 'weekdays' && isWeekend(next)))
  return next.getTime()
}

async function fire(job: ScheduledJob, now: number): Promise<void> {
  const next = nextFireAt(job, now)
  if (next === null) await storage.scheduled.delete(job.id)
  else await storage.scheduled.put({ ...job, fireAt: next })

  notifications.post({
    appId: job.appId,
    title: job.title,
    ...(job.body !== undefined ? { body: job.body } : {}),
    sound: false,
    launchArgs: { jobId: job.id, payload: job.payload }
  })
  if (job.sound) sound.play('alarm')
  emit('scheduler:fired', { jobId: job.id, appId: job.appId })
}

let timer: ReturnType<typeof setInterval> | null = null
let ticking = false

async function tick(): Promise<void> {
  if (ticking) return
  ticking = true
  try {
    const now = Date.now()
    // Un trabajo vencido se dispara una sola vez, aunque hayan pasado varios periodos.
    for (const job of await storage.scheduled.due(now)) await fire(job, now)
  } catch (error) {
    console.error('[programador] Falló la revisión de avisos:', error)
  } finally {
    ticking = false
  }
}

function assertValid(job: NewJob): void {
  if (!Number.isFinite(job.fireAt)) throw new TypeError('fireAt debe ser una fecha válida.')
  if (job.title.trim() === '') throw new TypeError('El aviso necesita un título.')
  const repeats: ScheduledRepeat[] = ['none', 'daily', 'weekdays']
  if (!repeats.includes(job.repeat)) throw new TypeError(`repeat no válido: ${String(job.repeat)}`)
}

export const scheduler = {
  async schedule(appId: string, job: NewJob): Promise<string> {
    assertValid(job)
    const id = crypto.randomUUID()
    await storage.scheduled.put({ ...job, id, appId })
    return id
  },

  async cancel(id: string): Promise<void> {
    await storage.scheduled.delete(id)
  },

  /** Avisos pendientes, del más próximo al más lejano; todos o solo los de una app. */
  async list(appId?: string): Promise<ScheduledJob[]> {
    const jobs = await storage.scheduled.all()
    return jobs.filter((job) => appId === undefined || job.appId === appId).sort((a, b) => a.fireAt - b.fireAt)
  },

  /** Empieza a revisar los avisos cada segundo. Dispara de inmediato los que vencieron con la sesión cerrada. */
  start(): void {
    if (timer !== null) return
    void tick()
    timer = setInterval(() => void tick(), TICK_MS)
  },

  stop(): void {
    if (timer === null) return
    clearInterval(timer)
    timer = null
  }
}
