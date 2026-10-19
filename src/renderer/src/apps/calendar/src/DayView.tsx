import { useEffect, useRef, useState } from 'react'
import { dateKey, formatTime, minutesOf, timeOf } from './dates'
import { layoutDay, type CalendarEvent } from './events'

const HOUR_HEIGHT = 48
const MIN_EVENT_HEIGHT = 22
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

/** Etiqueta de una hora en punto: "13:00" o "1 p. m.". */
const formatHour = (hour: number, hour24: boolean) =>
  hour24 ? timeOf(hour * 60) : `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? 'a. m.' : 'p. m.'}`

export interface DayViewProps {
  date: string
  events: CalendarEvent[]
  hour24: boolean
  onCreate: (start: string) => void
  onOpenEvent: (event: CalendarEvent) => void
}

function useNowMinutes(): number {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])
  return now.getHours() * 60 + now.getMinutes()
}

export function DayView({ date, events, hour24, onCreate, onOpenEvent }: DayViewProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const nowMinutes = useNowMinutes()
  const isToday = date === dateKey(new Date())

  // Al abrir un día (quien lo usa lo vuelve a montar con otro `key`) se muestra la primera cita o,
  // si no hay, la hora actual o las 7:00. Las citas que lleguen después no mueven el desplazamiento.
  const [anchor] = useState(() =>
    events.length > 0 ? Math.min(...events.map((event) => minutesOf(event.start))) : isToday ? nowMinutes : 7 * 60
  )
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, (anchor / 60 - 1) * HOUR_HEIGHT)
  }, [anchor])

  return (
    <div ref={scroller} className="calendar__day-view">
      <div className="calendar__timeline" style={{ height: HOURS.length * HOUR_HEIGHT }}>
        {HOURS.map((hour) => (
          <div key={hour} className="calendar__hour" style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}>
            <span className="calendar__hour-label">{hour === 0 ? '' : formatHour(hour, hour24)}</span>
            <button
              type="button"
              className="calendar__slot"
              aria-label={`Nuevo evento a las ${formatTime(timeOf(hour * 60), hour24)}`}
              onClick={() => onCreate(timeOf(hour * 60))}
            />
          </div>
        ))}
        <div className="calendar__events">
          {layoutDay(events).map(({ event, column, columns }) => {
            const top = (minutesOf(event.start) / 60) * HOUR_HEIGHT
            const height = Math.max(((minutesOf(event.end) - minutesOf(event.start)) / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT)
            return (
              <button
                key={event.id}
                type="button"
                className="calendar__event"
                style={{ top, height, left: `${(column / columns) * 100}%`, width: `${100 / columns}%` }}
                onClick={() => onOpenEvent(event)}
              >
                <span className="calendar__event-title">{event.title}</span>
                <span className="calendar__event-time">
                  {formatTime(event.start, hour24)} – {formatTime(event.end, hour24)}
                </span>
              </button>
            )
          })}
        </div>
        {isToday ? <div className="calendar__now" style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }} /> : null}
      </div>
    </div>
  )
}
