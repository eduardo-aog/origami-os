import type { ScheduledJob } from '@os/sdk'
import { isDateKey, isTimeValue, minutesOf, toTimestamp } from './dates'

/** Formato de los eventos en el `appData` (clave `event:<id>`); lo lee también el widget de Calendario. */
export interface CalendarEvent {
  id: string
  title: string
  /** Fecha en formato AAAA-MM-DD. */
  date: string
  /** Hora de inicio y de fin en formato HH:mm. */
  start: string
  end: string
  note?: string
  /** Minutos de antelación del recordatorio; `null` o ausente si no tiene. */
  reminder?: number | null
}

export const EVENT_PREFIX = 'event:'
export const eventKey = (id: string) => `${EVENT_PREFIX}${id}`

export const REMINDERS = [
  { value: 'none', label: 'Sin recordatorio' },
  { value: '0', label: 'Al inicio' },
  { value: '5', label: '5 minutos antes' },
  { value: '15', label: '15 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' }
]

export const sortEvents = (events: CalendarEvent[]) =>
  [...events].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.title.localeCompare(b.title, 'es'))

/** Mensaje de error si los datos del evento no son válidos. */
export function validateEvent(event: Pick<CalendarEvent, 'title' | 'date' | 'start' | 'end'>): string | null {
  if (event.title.trim() === '') return 'El evento necesita un título.'
  if (!isDateKey(event.date)) return 'Elige una fecha válida.'
  if (!isTimeValue(event.start) || !isTimeValue(event.end)) return 'Elige una hora de inicio y de fin válidas.'
  if (minutesOf(event.end) <= minutesOf(event.start)) return 'La hora de fin debe ser posterior a la de inicio.'
  return null
}

const isReminderJob = (job: ScheduledJob, eventId: string) => {
  const payload = job.payload as { kind?: unknown; eventId?: unknown } | null | undefined
  return payload?.kind === 'event' && payload.eventId === eventId
}

interface Scheduler {
  schedule(job: Omit<ScheduledJob, 'id' | 'appId'>): Promise<string>
  cancel(id: string): Promise<void>
  list(): Promise<ScheduledJob[]>
}

/** Deja programado como mucho un aviso por evento, o ninguno si no tiene recordatorio o ya pasó. */
export async function syncReminder(scheduler: Scheduler, event: CalendarEvent): Promise<void> {
  for (const job of await scheduler.list()) {
    if (isReminderJob(job, event.id)) await scheduler.cancel(job.id)
  }
  if (event.reminder === null || event.reminder === undefined) return
  const fireAt = toTimestamp(event.date, event.start) - event.reminder * 60_000
  if (fireAt <= Date.now()) return
  await scheduler.schedule({
    fireAt,
    title: event.title,
    body: event.reminder === 0 ? 'Empieza ahora' : event.reminder === 60 ? 'Empieza en 1 hora' : `Empieza en ${event.reminder} minutos`,
    sound: true,
    repeat: 'none',
    payload: { kind: 'event', eventId: event.id }
  })
}

export async function cancelReminder(scheduler: Scheduler, eventId: string): Promise<void> {
  for (const job of await scheduler.list()) {
    if (isReminderJob(job, eventId)) await scheduler.cancel(job.id)
  }
}

interface Placed {
  event: CalendarEvent
  column: number
  columns: number
}

/** Reparte en columnas los eventos de un día que se solapan. */
export function layoutDay(events: CalendarEvent[]): Placed[] {
  const sorted = sortEvents(events)
  const placed: Placed[] = []
  let cluster: Placed[] = []
  let clusterEnd = -1

  const closeCluster = () => {
    const columns = cluster.reduce((max, item) => Math.max(max, item.column + 1), 1)
    for (const item of cluster) item.columns = columns
    placed.push(...cluster)
    cluster = []
  }

  for (const event of sorted) {
    if (cluster.length > 0 && minutesOf(event.start) >= clusterEnd) closeCluster()
    const taken = new Set(
      cluster.filter((item) => minutesOf(item.event.end) > minutesOf(event.start)).map((item) => item.column)
    )
    let column = 0
    while (taken.has(column)) column += 1
    cluster.push({ event, column, columns: 1 })
    clusterEnd = Math.max(clusterEnd, minutesOf(event.end))
  }
  closeCluster()
  return placed
}
