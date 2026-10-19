import { useEffect, useState } from 'react'
import { useSetting, useWidgetOS } from '@os/sdk'
import './clock.css'

function useNow(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return now
}

function formatIn(now: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('es', { ...options, timeZone }).format(now)
  } catch {
    return new Intl.DateTimeFormat('es', options).format(now)
  }
}

function clockParts(now: Date, timeZone: string): { hours: number; minutes: number; seconds: number } {
  const [hours = 0, minutes = 0, seconds = 0] = formatIn(now, timeZone, {
    hourCycle: 'h23',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  })
    .split(':')
    .map(Number)
  return { hours, minutes, seconds }
}

function AnalogClock({ now, timeZone }: { now: Date; timeZone: string }) {
  const { hours, minutes, seconds } = clockParts(now, timeZone)
  const hourAngle = ((hours % 12) + minutes / 60) * 30
  const minuteAngle = (minutes + seconds / 60) * 6
  const secondAngle = seconds * 6
  return (
    <svg className="clock-widget__face" viewBox="-50 -50 100 100" role="img" aria-label={formatIn(now, timeZone, { timeStyle: 'short' })}>
      {Array.from({ length: 12 }, (_, i) => (
        <line key={i} className="clock-widget__tick" x1="0" y1="-44" x2="0" y2={i % 3 === 0 ? -37 : -40} transform={`rotate(${i * 30})`} />
      ))}
      <line className="clock-widget__hand" x1="0" y1="2" x2="0" y2="-24" strokeWidth="3.4" transform={`rotate(${hourAngle})`} />
      <line className="clock-widget__hand" x1="0" y1="3" x2="0" y2="-36" strokeWidth="2.4" transform={`rotate(${minuteAngle})`} />
      <line className="clock-widget__second" x1="0" y1="8" x2="0" y2="-38" strokeWidth="1" transform={`rotate(${secondAngle})`} />
      <circle className="clock-widget__pin" r="2.4" />
    </svg>
  )
}

export default function ClockWidget() {
  const { widget } = useWidgetOS()
  const timeZone = useSetting('datetime.timezone')
  const hour24 = useSetting('datetime.hour24')
  const now = useNow()

  if (widget.size === 'small') {
    return (
      <div className="clock-widget clock-widget--small">
        <AnalogClock now={now} timeZone={timeZone} />
      </div>
    )
  }

  return (
    <div className="clock-widget clock-widget--medium">
      <div className="clock-widget__time">{formatIn(now, timeZone, { hour: 'numeric', minute: '2-digit', hour12: !hour24 })}</div>
      <div className="clock-widget__date">{formatIn(now, timeZone, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
    </div>
  )
}
