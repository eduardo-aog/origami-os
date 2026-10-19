const number = (value: number, digits: number) =>
  value.toLocaleString('es', { minimumFractionDigits: digits, maximumFractionDigits: digits })

export const formatCpu = (percent: number) => `${number(percent, 1)} %`

export function formatMemory(megabytes: number): string {
  return megabytes >= 1024 ? `${number(megabytes / 1024, 1)} GB` : `${Math.round(megabytes)} MB`
}
