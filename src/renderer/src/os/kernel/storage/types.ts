import { z } from 'zod'
import '../validation'

export const avatarSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('builtin'), id: z.string().min(1) }).strict(),
  z.object({ type: z.literal('file'), nodeId: z.string().min(1) }).strict()
])
export type Avatar = z.output<typeof avatarSchema>

export const userRecordSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    avatar: avatarSchema,
    passwordHash: z.string().min(1),
    salt: z.string().min(1),
    createdAt: z.number()
  })
  .strict()
export type UserRecord = z.output<typeof userRecordSchema>

export interface MetaRecord {
  key: string
  value: unknown
}

export interface TrashInfo {
  originalParentId: string
  originalName: string
  trashedAt: number
}

export interface NodeRecord {
  id: string
  /** `null` solo en la raíz. */
  parentId: string | null
  name: string
  kind: 'file' | 'folder'
  mime: string
  size: number
  createdAt: number
  modifiedAt: number
  /** `null` en las carpetas. */
  blobId: string | null
  /** Carpetas protegidas: no se pueden renombrar, mover ni borrar. */
  system: boolean
  trash: TrashInfo | null
}

export interface BlobRecord {
  id: string
  data: Blob
}

export interface SettingRecord {
  key: string
  value: unknown
}

export interface AppDataRecord {
  appId: string
  key: string
  value: unknown
}

export type ScheduledRepeat = 'none' | 'daily' | 'weekdays'

export interface ScheduledJob {
  id: string
  appId: string
  /** Instante del próximo disparo, en milisegundos desde la época. */
  fireAt: number
  title: string
  body?: string
  sound: boolean
  repeat: ScheduledRepeat
  payload?: unknown
}
