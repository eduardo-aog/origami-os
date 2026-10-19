import Dexie, { type EntityTable, type Table } from 'dexie'
import type {
  AppDataRecord,
  BlobRecord,
  MetaRecord,
  NodeRecord,
  ScheduledJob,
  SettingRecord,
  UserRecord
} from './types'

/** Versión del esquema de datos. Cualquier cambio de tablas o índices la incrementa y añade una migración. */
export const SCHEMA_VERSION = 1

export class SimosDatabase extends Dexie {
  meta!: EntityTable<MetaRecord, 'key'>
  user!: EntityTable<UserRecord, 'id'>
  nodes!: EntityTable<NodeRecord, 'id'>
  blobs!: EntityTable<BlobRecord, 'id'>
  settings!: EntityTable<SettingRecord, 'key'>
  appData!: Table<AppDataRecord, [string, string]>
  scheduled!: EntityTable<ScheduledJob, 'id'>

  constructor() {
    super('simos')
    this.version(SCHEMA_VERSION).stores({
      meta: 'key',
      user: 'id',
      nodes: 'id, parentId, &[parentId+name]',
      blobs: 'id',
      settings: 'key',
      appData: '[appId+key], appId',
      scheduled: 'id, fireAt, appId'
    })
  }
}
