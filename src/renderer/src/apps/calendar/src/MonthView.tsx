import { WEEKDAYS, dateKey, formatTime, monthGrid, parseDateKey } from './dates'
import { sortEvents, type CalendarEvent } from './events'

const MAX_CHIPS = 3

export interface MonthViewProps {
  /** Cualquier día del mes que se muestra. */
  month: string
  selected: string
  eventsByDate: Map<string, CalendarEvent[]>
  hour24: boolean
  onSelect: (date: string) => void
  onOpenDay: (date: string) => void
  onOpenEvent: (event: CalendarEvent) => void
}

export function MonthView({ month, selected, eventsByDate, hour24, onSelect, onOpenDay, onOpenEvent }: MonthViewProps) {
  const today = dateKey(new Date())
  const currentMonth = parseDateKey(month).getMonth()
  return (
    <div className="calendar__month" role="grid" aria-label="Mes">
      <div className="calendar__weekdays" role="row">
        {WEEKDAYS.map((day) => (
          <span key={day} className="calendar__weekday" role="columnheader">
            {day}
          </span>
        ))}
      </div>
      <div className="calendar__days">
        {monthGrid(month).map((key) => {
          const date = parseDateKey(key)
          const events = sortEvents(eventsByDate.get(key) ?? [])
          const classes = [
            'calendar__day',
            date.getMonth() !== currentMonth ? 'calendar__day--outside' : '',
            key === today ? 'calendar__day--today' : '',
            key === selected ? 'calendar__day--selected' : ''
          ]
          return (
            <div
              key={key}
              className={classes.filter(Boolean).join(' ')}
              role="gridcell"
              tabIndex={0}
              aria-selected={key === selected}
              onClick={() => onSelect(key)}
              onDoubleClick={() => onOpenDay(key)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.key === 'Enter') onOpenDay(key)
                else if (event.key === ' ') {
                  event.preventDefault()
                  onSelect(key)
                }
              }}
            >
              <span className="calendar__day-number">{date.getDate()}</span>
              <ul className="calendar__chips">
                {events.slice(0, MAX_CHIPS).map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      className="calendar__chip"
                      title={`${formatTime(event.start, hour24)} ${event.title}`}
                      onClick={(click) => {
                        click.stopPropagation()
                        onOpenEvent(event)
                      }}
                      onDoubleClick={(click) => click.stopPropagation()}
                    >
                      <span className="calendar__chip-time">{formatTime(event.start, hour24)}</span> {event.title}
                    </button>
                  </li>
                ))}
                {events.length > MAX_CHIPS ? <li className="calendar__more">+{events.length - MAX_CHIPS} más</li> : null}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
