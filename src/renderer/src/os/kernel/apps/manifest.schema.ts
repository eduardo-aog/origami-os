import { z } from 'zod'
import '../validation'

export const APP_CATEGORIES = ['sistema', 'productividad', 'multimedia', 'utilidades'] as const
export const APP_PERMISSIONS = [
  'camera',
  'microphone',
  'settings:write',
  'system:processes',
  'system:peripherals',
  'system:account',
  'python'
] as const
export const WIDGET_SIZES = ['small', 'medium', 'large'] as const

const kebabId = z
  .string()
  .regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, 'debe estar en kebab-case (por ejemplo "text-editor")')

const metaFileName = z
  .string()
  .min(1)
  .regex(/^[^/\\]+$/, 'debe ser el nombre de un archivo dentro de meta/, sin rutas')

const fileExtension = z
  .string()
  .regex(/^[a-z0-9]+$/, 'debe ir en minúsculas y sin punto (por ejemplo "png")')

const windowSchema = z
  .object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    minWidth: z.number().int().positive().default(320),
    minHeight: z.number().int().positive().default(200),
    resizable: z.boolean().default(true),
    singleInstance: z.boolean().default(false)
  })
  .strict()
  .refine((w) => w.minWidth <= w.width, {
    path: ['minWidth'],
    message: 'no puede ser mayor que width'
  })
  .refine((w) => w.minHeight <= w.height, {
    path: ['minHeight'],
    message: 'no puede ser mayor que height'
  })

const fileAssociationSchema = z
  .object({
    extensions: z.array(fileExtension).min(1),
    role: z.enum(['editor', 'viewer']),
    priority: z.number().int().default(0)
  })
  .strict()

export const appManifestSchema = z
  .object({
    id: kebabId,
    name: z.string().trim().min(1),
    description: z.string().trim().min(1),
    version: z.string().min(1),
    author: z.string().default(''),
    icon: metaFileName,
    cover: metaFileName.optional(),
    category: z.enum(APP_CATEGORIES),
    launchpad: z
      .object({
        visible: z.boolean().default(true),
        order: z.number().default(1000)
      })
      .strict()
      .default({ visible: true, order: 1000 }),
    dock: z
      .object({ pinnedByDefault: z.boolean().default(false) })
      .strict()
      .default({ pinnedByDefault: false }),
    window: windowSchema,
    fileAssociations: z.array(fileAssociationSchema).default([]),
    permissions: z.array(z.enum(APP_PERMISSIONS)).default([])
  })
  .strict()

export const widgetManifestSchema = z
  .object({
    id: kebabId,
    name: z.string().trim().min(1),
    description: z.string().trim().min(1),
    icon: metaFileName,
    sizes: z.array(z.enum(WIDGET_SIZES)).min(1),
    defaultSize: z.enum(WIDGET_SIZES),
    ownerApp: kebabId.nullable().default(null)
  })
  .strict()
  .refine((w) => w.sizes.includes(w.defaultSize), {
    path: ['defaultSize'],
    message: 'debe ser uno de los tamaños declarados en sizes'
  })

export type AppManifest = z.output<typeof appManifestSchema>
export type AppCategory = (typeof APP_CATEGORIES)[number]
export type AppPermission = (typeof APP_PERMISSIONS)[number]
export type WidgetManifest = z.output<typeof widgetManifestSchema>
export type WidgetSize = (typeof WIDGET_SIZES)[number]
