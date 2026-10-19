import { useEffect, useState } from 'react'
import { useWidgetOS } from '@os/sdk'
import './calendar.css'

/** Formato de los eventos que guarda la app Calendario en su `appData` (clave `event:<id>`). */
interface CalendarEvent {
  id: string
  title: string
  /** Fecha en formato AAAA-MM-DD. */
  date: string
  /** Hora de inicio y de fin en formato HH:mm. */
  start: string
  end: string
  note?: string
  reminder?: number | null
}

const REFRESH_MS = 5000
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

const pad = (n: number) => String(n).padStart(2, '0')
const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

function useEvents(): CalendarEvent[] {
  const { storage } = useWidgetOS()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  useEffect(() => {
    let active = true
    const load = () => {
      storage
        .list<CalendarEvent>('event:')
        .then((records) => active && setEvents(records.map((record) => record.value)))
        .catch(() => undefined)
    }
    load()
    const timer = setInterval(load, REFRESH_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [storage])
  return events
}

function useToday(): Date {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])
  return today
}

function upcoming(events: CalendarEvent[], now: Date, limit: number): CalendarEvent[] {
  const nowKey = `${dateKey(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  return events
    .filter((event) => `${event.date} ${event.end}` >= nowKey)
    .sort((a, b) => `${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`))
    .slice(0, limit)
}

function eventWhen(event: CalendarEvent, today: string): string {
  if (event.date === today) return event.start
  const [year = 0, month = 1, day = 1] = event.date.split('-').map(Number)
  return `${new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day))} ${event.start}`
}

function UpcomingList({ events, today }: { events: CalendarEvent[]; today: string }) {
  if (events.length === 0) return <p className="calendar-widget__empty">Sin eventos próximos</p>
  return (
    <ul className="calendar-widget__events">
      {events.map((event) => (
        <li key={event.id}>
          <span className="calendar-widget__when">{eventWhen(event, today)}</span>
          <span className="calendar-widget__title">{event.title}</span>
        </li>
      ))}
    </ul>
  )
}

function MonthGrid({ today, eventDays }: { today: Date; eventDays: Set<string> }) {
  const first = new Date(today.getFullYear(), today.getMonth(), 1)
  const offset = (first.getDay() + 6) % 7
  const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) => i - offset + 1)
  return (
    <div className="calendar-widget__grid" role="grid">
      {WEEKDAYS.map((day) => (
        <span key={day} className="calendar-widget__weekday">
          {day}
        </span>
      ))}
      {cells.map((day, index) => {
        if (day < 1 || day > days) return <span key={index} />
        const key = dateKey(new Date(today.getFullYear(), today.getMonth(), day))
        return (
          <span
            key={index}
            className={`calendar-widget__day${day === today.getDate() ? ' calendar-widget__day--today' : ''}${eventDays.has(key) ? ' calendar-widget__day--busy' : ''}`}
          >
            {day}
          </span>
        )
      })}
    </div>
  )
}

export default function CalendarWidget() {
  const { widget } = useWidgetOS()
  const events = useEvents()
  const today = useToday()
  const todayKey = dateKey(today)
  const month = new Intl.DateTimeFormat('es', { month: 'long' }).format(today)

  if (widget.size === 'large') {
    return (
      <div className="calendar-widget calendar-widget--large">
        <h3 className="calendar-widget__month">
          {month} {today.getFullYear()}
        </h3>
        <MonthGrid today={today} eventDays={new Set(events.map((event) => event.date))} />
        <UpcomingList events={upcoming(events, today, 3)} today={todayKey} />
      </div>
    )
  }

  return (
    <div className="calendar-widget calendar-widget--medium">
      <div className="calendar-widget__today">
        <span className="calendar-widget__month">{month}</span>
        <span className="calendar-widget__number">{today.getDate()}</span>
      </div>
      <UpcomingList events={upcoming(events, today, 3)} today={todayKey} />
    </div>
  )
}
