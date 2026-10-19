import { SCHEMA_VERSION, SimosDatabase } from './db'
import type {
  AppDataRecord,
  BlobRecord,
  NodeRecord,
  ScheduledJob,
  SettingRecord,
  UserRecord
} from './types'

export * from './types'
export { SCHEMA_VERSION } from './db'

/*
 * Único módulo del proyecto que toca Dexie/IndexedDB (sección 3.2, regla 3).
 * Los demás servicios usan este objeto y nunca ven la base de datos.
 */
const db = new SimosDatabase()

function allTables() {
  return [db.meta, db.user, db.nodes, db.blobs, db.settings, db.appData, db.scheduled]
}

export const storage = {
  /** Abre la base de datos. Es seguro llamarla varias veces. */
  async open(): Promise<void> {
    await db.open()
    await db.meta.put({ key: 'schemaVersion', value: SCHEMA_VERSION })
  },

  /**
   * Ejecuta `work` en una única transacción de lectura y escritura sobre todas las tablas.
   * Dentro solo se pueden esperar operaciones de `storage`: esperar otra cosa (por ejemplo
   * `blob.text()`) cierra la transacción antes de tiempo.
   */
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await db.transaction('rw', allTables(), work)
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        throw new Error('No hay espacio suficiente para guardar los cambios.', { cause: error })
      }
      throw error
    }
  },

  meta: {
    async get<T>(key: string): Promise<T | undefined> {
      return (await db.meta.get(key))?.value as T | undefined
    },
    async set(key: string, value: unknown): Promise<void> {
      await db.meta.put({ key, value })
    }
  },

  user: {
    get(): Promise<UserRecord | undefined> {
      return db.user.get('user')
    },
    async put(user: UserRecord): Promise<void> {
      await db.user.put(user)
    }
  },

  nodes: {
    get(id: string): Promise<NodeRecord | undefined> {
      return db.nodes.get(id)
    },
    getByName(parentId: string, name: string): Promise<NodeRecord | undefined> {
      return db.nodes.where('[parentId+name]').equals([parentId, name]).first()
    },
    children(parentId: string): Promise<NodeRecord[]> {
      return db.nodes.where('parentId').equals(parentId).toArray()
    },
    async put(node: NodeRecord): Promise<void> {
      await db.nodes.put(node)
    },
    async bulkDelete(ids: string[]): Promise<void> {
      await db.nodes.bulkDelete(ids)
    },
    /** Total de bytes y de archivos (las carpetas no cuentan). */
    async usage(): Promise<{ bytes: number; files: number }> {
      let bytes = 0
      let files = 0
      await db.nodes.each((node) => {
        if (node.kind === 'file') {
          bytes += node.size
          files += 1
        }
      })
      return { bytes, files }
    }
  },

  blobs: {
    get(id: string): Promise<BlobRecord | undefined> {
      return db.blobs.get(id)
    },
    async put(blob: BlobRecord): Promise<void> {
      await db.blobs.put(blob)
    },
    async bulkDelete(ids: string[]): Promise<void> {
      await db.blobs.bulkDelete(ids)
    }
  },

  settings: {
    all(): Promise<SettingRecord[]> {
      return db.settings.toArray()
    },
    async set(key: string, value: unknown): Promise<void> {
      await db.settings.put({ key, value })
    },
    async bulkSet(records: SettingRecord[]): Promise<void> {
      await db.settings.bulkPut(records)
    }
  },

  appData: {
    async get<T>(appId: string, key: string): Promise<T | undefined> {
      return (await db.appData.get([appId, key]))?.value as T | undefined
    },
    async set(appId: string, key: string, value: unknown): Promise<void> {
      await db.appData.put({ appId, key, value })
    },
    async delete(appId: string, key: string): Promise<void> {
      await db.appData.delete([appId, key])
    },
    /** Entradas de una app cuya clave empieza por `prefix`, ordenadas por clave. */
    list(appId: string, prefix = ''): Promise<AppDataRecord[]> {
      return db.appData
        .where('[appId+key]')
        .between([appId, prefix], [appId, `${prefix}￿`], true, true)
        .toArray()
    }
  },

  scheduled: {
    get(id: string): Promise<ScheduledJob | undefined> {
      return db.scheduled.get(id)
    },
    async put(job: ScheduledJob): Promise<void> {
      await db.scheduled.put(job)
    },
    async delete(id: string): Promise<void> {
      await db.scheduled.delete(id)
    },
    all(): Promise<ScheduledJob[]> {
      return db.scheduled.toArray()
    },
    /** Trabajos cuyo `fireAt` ya llegó, del más antiguo al más reciente. */
    due(now: number): Promise<ScheduledJob[]> {
      return db.scheduled.where('fireAt').belowOrEqual(now).sortBy('fireAt')
    }
  }
}
