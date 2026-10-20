import { useSetting } from '@os/sdk'

const number = (value: number, digits: number) =>
  value.toLocaleString('es', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const formatCpu = (percent: number) => `${number(percent, 1)} %`

export function formatMemory(megabytes: number): string {
  return megabytes >= 1024 ? `${number(megabytes / 1024, 1)} GB` : `${Math.round(megabytes)} MB`
}

/** Los tamaños del disco usan GB y TB (1 TB = 1024 GB, como la memoria) con hasta dos decimales. */
export function formatSize(megabytes: number): string {
  const amount = (value: number) => value.toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
  if (megabytes >= 1024 * 1024) return `${amount(megabytes / (1024 * 1024))} TB`
  if (megabytes >= 1024) return `${amount(megabytes / 1024)} GB`
  return `${Math.round(megabytes)} MB`
}

export const formatRate = (megabytesPerSecond: number) => `${Math.round(megabytesPerSecond)} MB/s`

/** Hora con segundos según la zona horaria y el formato de 12/24 horas que eligió el usuario. */
export function useTimeFormatter(): (timestamp: number) => string {
  const timeZone = useSetting('datetime.timezone')
  const hour24 = useSetting('datetime.hour24')
  const formatter = new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: !hour24,
    timeZone
  })
  return (timestamp) => formatter.format(timestamp)
}
