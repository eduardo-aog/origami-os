const pad = (n: number) => String(n).padStart(2, '0')

/** Fecha en formato AAAA-MM-DD, la que usan los eventos. */
export const dateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export function parseDateKey(key: string): Date {
  const [year = 1970, month = 1, day = 1] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateKey(value).getTime())

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

export function addMonths(key: string, months: number): string {
  const date = parseDateKey(key)
  const day = date.getDate()
  date.setDate(1)
  date.setMonth(date.getMonth() + months)
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  date.setDate(Math.min(day, last))
  return dateKey(date)
}

/** Minutos desde la medianoche de una hora HH:mm. */
export function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export const timeOf = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`

export const isTimeValue = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

/** Hora de una cita en formato de 12 o 24 horas, según el ajuste del sistema. */
export function formatTime(time: string, hour24: boolean): string {
  if (hour24) return time
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return `${hours % 12 === 0 ? 12 : hours % 12}:${pad(minutes)} ${hours < 12 ? 'a. m.' : 'p. m.'}`
}

export function toTimestamp(date: string, time: string): number {
  const day = parseDateKey(date)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutesOf(time)).getTime()
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

export function formatMonth(key: string): string {
  return capitalize(new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(parseDateKey(key)))
}

export function formatDay(key: string): string {
  return capitalize(new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(parseDateKey(key)))
}

/** Las 6 semanas (lunes a domingo) que cubren el mes de `key`. */
export function monthGrid(key: string): string[] {
  const first = parseDateKey(key)
  first.setDate(1)
  const offset = (first.getDay() + 6) % 7
  const start = dateKey(first)
  return Array.from({ length: 42 }, (_, index) => addDays(start, index - offset))
}

export const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']
