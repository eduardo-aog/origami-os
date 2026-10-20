import { z } from 'zod'
import rawConfig from '@system/os.config.json'
import { formatIssues } from '../validation'

export const osConfigSchema = z
  .object({
    name: z.string().trim().min(1),
    version: z.string().min(1),
    bootDurationMs: z.number().int().min(0),
    startFullscreen: z.boolean(),
    simulatedMemoryMB: z.number().int().positive(),
    simulatedDiskMB: z.number().int().positive(),
    simulatedCores: z.number().int().min(1).max(8),
    defaults: z
      .object({
        theme: z.enum(['light', 'dark', 'auto']),
        accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'debe ser un color hexadecimal como #0A84FF'),
        wallpaper: z.string().min(1),
        timezone: z.string().min(1),
        hour24: z.boolean()
      })
      .strict(),
    accentColors: z
      .array(
        z
          .object({
            name: z.string().trim().min(1),
            value: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'debe ser un color hexadecimal como #0A84FF')
          })
          .strict()
      )
      .min(1)
  })
  .strict()

export type OsConfig = z.output<typeof osConfigSchema>

function loadOsConfig(): OsConfig {
  const result = osConfigSchema.safeParse(rawConfig)
  if (!result.success) {
    throw new Error(
      `system/os.config.json no es válido:\n${formatIssues(result.error)
        .map((line) => `  • ${line}`)
        .join('\n')}`
    )
  }
  return result.data
}

/** Configuración del sistema (`system/os.config.json`), validada al cargar. */
export const osConfig: OsConfig = loadOsConfig()
