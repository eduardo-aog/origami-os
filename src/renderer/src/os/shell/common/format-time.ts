/** Formatea con la zona horaria de `datetime.timezone`; si es inválida, usa la del equipo. */
export function formatInTimeZone(now: Date, timeZone: string, options: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat('es', { ...options, timeZone }).format(now)
  } catch {
    return new Intl.DateTimeFormat('es', options).format(now)
  }
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
