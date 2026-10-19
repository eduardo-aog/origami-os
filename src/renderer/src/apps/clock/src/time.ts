import { useEffect, useState } from 'react'

export const pad = (n: number) => String(n).padStart(2, '0')

/** Instante actual (ms), que se actualiza cada `intervalMs` mientras `active` sea verdadero. */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    // Al activarse, el primer valor llega enseguida: el que había guardado puede ser muy antiguo.
    const first = setTimeout(() => setNow(Date.now()), 0)
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [intervalMs, active])
  return now
}

const isValidZone = (zone: string) => {
  try {
    new Intl.DateTimeFormat('es', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** Zona horaria utilizable: la indicada o, si no es válida, la del equipo. */
export const safeZone = (zone: string): string | undefined => (isValidZone(zone) ? zone : undefined)

export function formatInZone(now: number, zone: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('es', { ...options, timeZone: safeZone(zone) }).format(now)
}

/** Diferencia en minutos entre la hora de pared de `zone` y UTC en el instante `now`. */
export function offsetMinutes(now: number, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: safeZone(zone),
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  }).formatToParts(now)
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'))
  return Math.round((asUtc - Math.floor(now / 1000) * 1000) / 60_000)
}

/** Hora HH:mm en formato de 12 o 24 horas, según el ajuste del sistema. */
export function formatHm(time: string, hour24: boolean): string {
  if (hour24) return time
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return `${hours % 12 === 0 ? 12 : hours % 12}:${pad(minutes)} ${hours < 12 ? 'a. m.' : 'p. m.'}`
}

export type Repeat = 'none' | 'daily' | 'weekdays'

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6

/** Próximo instante, posterior a `from`, en el que el reloj marca `time` (y es día laborable si hace falta). */
export function nextOccurrence(time: string, repeat: Repeat, from = Date.now()): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  const next = new Date(from)
  next.setHours(hours, minutes, 0, 0)
  while (next.getTime() <= from || (repeat === 'weekdays' && isWeekend(next))) next.setDate(next.getDate() + 1)
  return next.getTime()
}

/** Duración como HH:MM:SS (las horas solo si hacen falta cuando `alwaysHours` es falso). */
export function formatDuration(ms: number, alwaysHours = true): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return alwaysHours || hours > 0 ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`
}
