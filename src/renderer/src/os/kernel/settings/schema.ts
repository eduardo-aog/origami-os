import { z } from 'zod'
import '../validation'
import { apps } from '../apps'
import { osConfig } from '../config'

/*
 * Todas las claves de configuración válidas, con su tipo y su valor por defecto.
 * Es el único lugar donde se definen (sección 4.5 de la especificación).
 */
const wallpaperSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('builtin'), id: z.string().min(1) }).strict(),
  z.object({ type: z.literal('file'), nodeId: z.string().min(1) }).strict()
])

const desktopItemSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['app', 'node']),
    ref: z.string().min(1),
    x: z.number(),
    y: z.number()
  })
  .strict()

const desktopWidgetSchema = z
  .object({
    id: z.string().min(1),
    widgetId: z.string().min(1),
    size: z.enum(['small', 'medium', 'large']),
    x: z.number(),
    y: z.number()
  })
  .strict()

export const settingSchemas = {
  'appearance.theme': z.enum(['light', 'dark', 'auto']),
  'appearance.accent': z.string().regex(/^#[0-9a-fA-F]{6}$/, 'debe ser un color hexadecimal como #0A84FF'),
  'appearance.wallpaper': wallpaperSchema,
  'desktop.items': z.array(desktopItemSchema),
  'desktop.widgets': z.array(desktopWidgetSchema),
  'dock.pinned': z.array(z.string().min(1)),
  'dock.iconSize': z.number().int().min(32).max(128),
  'dock.gap': z.number().int().min(0).max(24),
  'sound.volume': z.number().int().min(0).max(100),
  'sound.muted': z.boolean(),
  'sound.systemSounds': z.boolean(),
  'datetime.timezone': z.string().min(1),
  'datetime.hour24': z.boolean(),
  'fileAssociations.defaults': z.record(z.string(), z.string())
} as const

export type SettingKey = keyof typeof settingSchemas
export type SettingValue<K extends SettingKey> = z.output<(typeof settingSchemas)[K]>
export type SettingValues = { [K in SettingKey]: SettingValue<K> }

function defaultPinnedApps(): string[] {
  return apps
    .filter((app) => app.manifest.dock.pinnedByDefault)
    .sort((a, b) => a.manifest.launchpad.order - b.manifest.launchpad.order)
    .map((app) => app.manifest.id)
}

export const settingDefaults: SettingValues = {
  'appearance.theme': osConfig.defaults.theme,
  'appearance.accent': osConfig.defaults.accent,
  'appearance.wallpaper': { type: 'builtin', id: osConfig.defaults.wallpaper },
  'desktop.items': [],
  'desktop.widgets': [],
  'dock.pinned': defaultPinnedApps(),
  'dock.iconSize': 56,
  'dock.gap': 4,
  'sound.volume': 70,
  'sound.muted': false,
  'sound.systemSounds': true,
  'datetime.timezone': osConfig.defaults.timezone,
  'datetime.hour24': osConfig.defaults.hour24,
  'fileAssociations.defaults': {}
}

export function isSettingKey(key: string): key is SettingKey {
  return Object.hasOwn(settingSchemas, key)
}
