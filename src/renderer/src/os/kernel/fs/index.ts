import { emit, type FsChangeKind } from '../events'
import { native } from '../native'
import { storage, type NodeRecord } from '../storage'
import { FALLBACK_MIME, mimeFromFileName } from './mime'
import { ROOT_ID, TRASH_ID, USERS_DIR, pathSegments, validateNodeName } from './paths'
import { FsError, type FsApi } from './types'

export { createInitialTree } from './tree'
export { FsError } from './types'
export type { FsApi, FsErrorCode, FsNode } from './types'
export { baseName, joinPath, parentPath, validateNodeName, ROOT_ID, TRASH_ID, TRASH_NAME } from './paths'

const uuid = () => crypto.randomUUID()
const byName = (a: NodeRecord, b: NodeRecord) =>
  a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' })

function notify(kind: FsChangeKind, node: NodeRecord, oldParentId?: string | null): void {
  emit('fs:changed', {
    kind,
    nodeId: node.id,
    parentId: node.parentId ?? '',
    ...(oldParentId ? { oldParentId } : {})
  })
}

/* ───────────── Resolución de rutas ───────────── */

async function getNode(id: string): Promise<NodeRecord> {
  const node = await storage.nodes.get(id)
  if (!node) throw new FsError('ENOENT', 'El elemento ya no existe.')
  return node
}

/** Expande "~" y devuelve los segmentos de una ruta absoluta. */
async function expand(path: string): Promise<string[]> {
  let absolute = path
  if (path === '~' || path.startsWith('~/')) {
    const user = await storage.user.get()
    if (!user) throw new FsError('ENOENT', 'Todavía no hay una carpeta de inicio.')
    absolute = `/${USERS_DIR}/${user.name}${path.slice(1)}`
  }
  if (!absolute.startsWith('/')) {
    throw new FsError('EINVAL', `La ruta debe ser absoluta: "${path}".`)
  }
  return pathSegments(absolute)
}

async function walk(segments: string[], shownPath: string): Promise<NodeRecord> {
  let node = await storage.nodes.get(ROOT_ID)
  if (!node) throw new FsError('ENOENT', `No existe "${shownPath}".`)
  for (const segment of segments) {
    if (node.kind !== 'folder') throw new FsError('ENOTDIR', `"${node.name}" no es una carpeta.`)
    const child: NodeRecord | undefined = await storage.nodes.getByName(node.id, segment)
    if (!child) throw new FsError('ENOENT', `No existe "${shownPath}".`)
    node = child
  }
  return node
}

async function resolve(path: string): Promise<NodeRecord> {
  return walk(await expand(path), path)
}

async function resolveFolder(path: string): Promise<NodeRecord> {
  const node = await resolve(path)
  if (node.kind !== 'folder') throw new FsError('ENOTDIR', `"${node.name}" no es una carpeta.`)
  return node
}

async function resolveParent(path: string): Promise<{ parent: NodeRecord; name: string }> {
  const segments = await expand(path)
  const name = segments.pop()
  if (name === undefined) {
    throw new FsError('EINVAL', 'Esa operación no se puede aplicar a la carpeta raíz.')
  }
  const parent = await walk(segments, `/${segments.join('/')}`)
  if (parent.kind !== 'folder') throw new FsError('ENOTDIR', `"${parent.name}" no es una carpeta.`)
  return { parent, name }
}

/** ¿`node` es `ancestorId` o está dentro de esa carpeta? */
async function isWithin(node: NodeRecord, ancestorId: string): Promise<boolean> {
  let current: NodeRecord | undefined = node
  while (current) {
    if (current.id === ancestorId) return true
    current = current.parentId === null ? undefined : await storage.nodes.get(current.parentId)
  }
  return false
}

async function assertWritable(folder: NodeRecord): Promise<void> {
  if (await isWithin(folder, TRASH_ID)) {
    throw new FsError('EPERM', 'La papelera no se puede modificar directamente.')
  }
}

function assertMovable(node: NodeRecord, verb: string): void {
  if (node.id === ROOT_ID || node.system) {
    throw new FsError('EPERM', `"${node.name || '/'}" es una carpeta del sistema y no se puede ${verb}.`)
  }
  if (node.trash) {
    throw new FsError('EPERM', `"${node.name}" está en la papelera: restáuralo antes de ${verb}.`)
  }
}

function assertValidName(name: string): void {
  const problem = validateNodeName(name)
  if (problem) throw new FsError('EINVAL', problem)
}

/** Nombre libre en la carpeta: "informe.txt" → "informe (2).txt". */
async function uniqueName(parentId: string, desired: string, kind: NodeRecord['kind']): Promise<string> {
  if (!(await storage.nodes.getByName(parentId, desired))) return desired
  const dot = desired.lastIndexOf('.')
  const hasExtension = kind === 'file' && dot > 0
  const extension = hasExtension ? desired.slice(dot) : ''
  const stem = (hasExtension ? desired.slice(0, dot) : desired).replace(/ \(\d+\)$/, '')
  for (let n = 2; ; n++) {
    const candidate = `${stem} (${n})${extension}`
    if (!(await storage.nodes.getByName(parentId, candidate))) return candidate
  }
}

function newFolder(parentId: string, name: string): NodeRecord {
  const now = Date.now()
  return {
    id: uuid(),
    parentId,
    name,
    kind: 'folder',
    mime: '',
    size: 0,
    createdAt: now,
    modifiedAt: now,
    blobId: null,
    system: false,
    trash: null
  }
}

function resolveMime(name: string, data: Blob | string, explicit?: string): string {
  if (explicit) return explicit
  const byExtension = mimeFromFileName(name)
  if (byExtension !== FALLBACK_MIME) return byExtension
  return typeof data !== 'string' && data.type ? data.type : byExtension
}

/* ───────────── Copias y borrado de subárboles ───────────── */

async function cloneInto(source: NodeRecord, parentId: string, name: string): Promise<NodeRecord> {
  const now = Date.now()
  const copy: NodeRecord = {
    ...source,
    id: uuid(),
    parentId,
    name,
    createdAt: now,
    modifiedAt: now,
    system: false,
    trash: null,
    blobId: null
  }
  if (source.kind === 'file' && source.blobId) {
    const blob = await storage.blobs.get(source.blobId)
    if (blob) {
      copy.blobId = uuid()
      await storage.blobs.put({ id: copy.blobId, data: blob.data })
    }
  }
  await storage.nodes.put(copy)
  if (source.kind === 'folder') {
    for (const child of await storage.nodes.children(source.id)) {
      await cloneInto(child, copy.id, child.name)
    }
  }
  return copy
}

async function deleteSubtree(root: NodeRecord): Promise<void> {
  const nodeIds: string[] = []
  const blobIds: string[] = []
  const pending: NodeRecord[] = [root]
  for (let node = pending.pop(); node; node = pending.pop()) {
    nodeIds.push(node.id)
    if (node.blobId) blobIds.push(node.blobId)
    if (node.kind === 'folder') pending.push(...(await storage.nodes.children(node.id)))
  }
  await storage.nodes.bulkDelete(nodeIds)
  await storage.blobs.bulkDelete(blobIds)
}

/**
 * Renombra la carpeta de inicio (`/Usuarios/<nombre>`) cuando cambia el nombre de la cuenta. No forma
 * parte de `FsApi` porque las carpetas del sistema no se pueden renombrar: solo la sesión la usa,
 * dentro de su transacción, y quien la llama emite `fs:changed` cuando la transacción termina.
 */
export async function renameHomeFolder(oldName: string, newName: string): Promise<NodeRecord> {
  assertValidName(newName)
  const users = await storage.nodes.getByName(ROOT_ID, USERS_DIR)
  const home = users ? await storage.nodes.getByName(users.id, oldName) : undefined
  if (!users || !home) throw new FsError('ENOENT', 'No se encontró la carpeta de inicio.')
  if (oldName === newName) return home
  if (await storage.nodes.getByName(users.id, newName)) {
    throw new FsError('EEXIST', `Ya existe un elemento llamado "${newName}" en esta carpeta.`)
  }
  const renamed: NodeRecord = { ...home, name: newName }
  await storage.nodes.put(renamed)
  return renamed
}

/* ───────────── API pública ───────────── */

export const fs: FsApi = {
  stat: (path) => resolve(path),

  async list(path) {
    const folder = await resolveFolder(path)
    const children = await storage.nodes.children(folder.id)
    return children.filter((child) => child.trash === null && !child.name.startsWith('.')).sort(byName)
  },

  async exists(path) {
    try {
      await resolve(path)
      return true
    } catch (error) {
      if (error instanceof FsError && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) return false
      throw error
    }
  },

  async readFile(path) {
    const node = await resolve(path)
    if (node.kind === 'folder') throw new FsError('EISDIR', `"${node.name}" es una carpeta.`)
    const blob = node.blobId ? await storage.blobs.get(node.blobId) : undefined
    if (!blob) throw new FsError('ENOENT', `No se encontró el contenido de "${node.name}".`)
    return blob.data
  },

  async readText(path) {
    return (await fs.readFile(path)).text()
  },

  async writeFile(path, data, opts = {}) {
    const { node, kind } = await storage.transaction(async () => {
      const { parent, name } = await resolveParent(path)
      assertValidName(name)
      await assertWritable(parent)
      const mime = resolveMime(name, data, opts.mime)
      const blob = typeof data === 'string' ? new Blob([data], { type: mime }) : data.slice(0, data.size, mime)
      const existing = await storage.nodes.getByName(parent.id, name)
      const now = Date.now()

      if (existing) {
        if (existing.kind === 'folder') throw new FsError('EISDIR', `"${name}" es una carpeta.`)
        if (!opts.overwrite) {
          throw new FsError('EEXIST', `Ya existe un elemento llamado "${name}" en esta carpeta.`)
        }
        const blobId = existing.blobId ?? uuid()
        await storage.blobs.put({ id: blobId, data: blob })
        const updated: NodeRecord = { ...existing, blobId, mime, size: blob.size, modifiedAt: now }
        await storage.nodes.put(updated)
        return { node: updated, kind: 'update' as const }
      }

      const blobId = uuid()
      await storage.blobs.put({ id: blobId, data: blob })
      const created: NodeRecord = {
        id: uuid(),
        parentId: parent.id,
        name,
        kind: 'file',
        mime,
        size: blob.size,
        createdAt: now,
        modifiedAt: now,
        blobId,
        system: false,
        trash: null
      }
      await storage.nodes.put(created)
      return { node: created, kind: 'create' as const }
    })
    notify(kind, node)
    return node
  },

  async mkdir(path, opts = {}) {
    const { node, created } = await storage.transaction(async () => {
      const segments = await expand(path)
      if (segments.length === 0) throw new FsError('EEXIST', 'La carpeta raíz ya existe.')
      let current = await walk([], path)
      const created: NodeRecord[] = []

      for (const [index, segment] of segments.entries()) {
        const isLast = index === segments.length - 1
        const existing = await storage.nodes.getByName(current.id, segment)
        if (existing) {
          if (existing.kind !== 'folder') {
            throw new FsError(isLast ? 'EEXIST' : 'ENOTDIR', `"${segment}" ya existe y no es una carpeta.`)
          }
          if (isLast && !opts.recursive) {
            throw new FsError('EEXIST', `Ya existe un elemento llamado "${segment}" en esta carpeta.`)
          }
          current = existing
          continue
        }
        if (!isLast && !opts.recursive) throw new FsError('ENOENT', `No existe "${path}".`)
        assertValidName(segment)
        await assertWritable(current)
        const folder = newFolder(current.id, segment)
        await storage.nodes.put(folder)
        created.push(folder)
        current = folder
      }
      return { node: current, created }
    })
    for (const folder of created) notify('create', folder)
    return node
  },

  async rename(path, newName) {
    assertValidName(newName)
    const { node, changed } = await storage.transaction(async () => {
      const node = await resolve(path)
      assertMovable(node, 'renombrar')
      if (node.name === newName) return { node, changed: false }
      const parentId = node.parentId ?? ROOT_ID
      if (await storage.nodes.getByName(parentId, newName)) {
        throw new FsError('EEXIST', `Ya existe un elemento llamado "${newName}" en esta carpeta.`)
      }
      const renamed: NodeRecord = { ...node, name: newName }
      await storage.nodes.put(renamed)
      return { node: renamed, changed: true }
    })
    if (changed) notify('update', node)
    return node
  },

  async move(path, destDir) {
    const { node, oldParentId } = await storage.transaction(async () => {
      const node = await resolve(path)
      assertMovable(node, 'mover')
      const dest = await resolveFolder(destDir)
      await assertWritable(dest)
      if (await isWithin(dest, node.id)) {
        throw new FsError('EINVAL', 'No se puede mover una carpeta dentro de sí misma.')
      }
      if (node.parentId === dest.id) return { node, oldParentId: null }
      const name = await uniqueName(dest.id, node.name, node.kind)
      const moved: NodeRecord = { ...node, parentId: dest.id, name }
      await storage.nodes.put(moved)
      return { node: moved, oldParentId: node.parentId }
    })
    if (oldParentId) notify('move', node, oldParentId)
    return node
  },

  async copy(path, destDir) {
    const node = await storage.transaction(async () => {
      const source = await resolve(path)
      if (source.id === ROOT_ID || source.id === TRASH_ID) {
        throw new FsError('EPERM', `"${source.name || '/'}" no se puede copiar.`)
      }
      const dest = await resolveFolder(destDir)
      await assertWritable(dest)
      if (source.kind === 'folder' && (await isWithin(dest, source.id))) {
        throw new FsError('EINVAL', 'No se puede copiar una carpeta dentro de sí misma.')
      }
      const name = await uniqueName(dest.id, source.name, source.kind)
      return cloneInto(source, dest.id, name)
    })
    notify('create', node)
    return node
  },

  async duplicate(path) {
    const node = await storage.transaction(async () => {
      const source = await resolve(path)
      if (source.id === ROOT_ID || source.id === TRASH_ID) {
        throw new FsError('EPERM', `"${source.name || '/'}" no se puede duplicar.`)
      }
      const parent = await getNode(source.parentId ?? ROOT_ID)
      await assertWritable(parent)
      const name = await uniqueName(parent.id, source.name, source.kind)
      return cloneInto(source, parent.id, name)
    })
    notify('create', node)
    return node
  },

  async trash(path) {
    const { node, oldParentId } = await storage.transaction(async () => {
      const node = await resolve(path)
      assertMovable(node, 'mover a la papelera')
      if (await isWithin(node, TRASH_ID)) {
        throw new FsError('EINVAL', `"${node.name}" ya está en la papelera.`)
      }
      const originalParentId = node.parentId ?? ROOT_ID
      const trashed: NodeRecord = {
        ...node,
        parentId: TRASH_ID,
        name: await uniqueName(TRASH_ID, node.name, node.kind),
        trash: { originalParentId, originalName: node.name, trashedAt: Date.now() }
      }
      await storage.nodes.put(trashed)
      return { node: trashed, oldParentId: originalParentId }
    })
    notify('trash', node, oldParentId)
  },

  async listTrash() {
    const items = await storage.nodes.children(TRASH_ID)
    return items.sort((a, b) => (b.trash?.trashedAt ?? 0) - (a.trash?.trashedAt ?? 0))
  },

  async restore(nodeId) {
    const node = await storage.transaction(async () => {
      const item = await getNode(nodeId)
      if (!item.trash) throw new FsError('EINVAL', `"${item.name}" no está en la papelera.`)
      let target = await storage.nodes.get(item.trash.originalParentId)
      if (!target || target.kind !== 'folder' || (await isWithin(target, TRASH_ID))) {
        target = await resolveFolder('~')
      }
      const restored: NodeRecord = {
        ...item,
        parentId: target.id,
        name: await uniqueName(target.id, item.trash.originalName, item.kind),
        trash: null
      }
      await storage.nodes.put(restored)
      return restored
    })
    notify('restore', node, TRASH_ID)
    return node
  },

  async deletePermanently(nodeId) {
    const node = await storage.transaction(async () => {
      const item = await getNode(nodeId)
      if (!item.trash) {
        throw new FsError('EPERM', 'Solo se pueden eliminar definitivamente elementos de la papelera.')
      }
      await deleteSubtree(item)
      return item
    })
    notify('delete', node)
  },

  async emptyTrash() {
    const items = await storage.transaction(async () => {
      const items = await storage.nodes.children(TRASH_ID)
      for (const item of items) await deleteSubtree(item)
      return items
    })
    for (const item of items) notify('delete', item)
  },

  async importFromHost(destDir, opts = {}) {
    const files = await native().files.importFromHost({ multiple: opts.multiple ?? false })
    if (files.length === 0) return []

    const created = await storage.transaction(async () => {
      const dest = await resolveFolder(destDir)
      await assertWritable(dest)
      const nodes: NodeRecord[] = []
      for (const file of files) {
        assertValidName(file.name)
        const now = Date.now()
        const blob = new Blob([file.data], { type: file.mime })
        const blobId = uuid()
        await storage.blobs.put({ id: blobId, data: blob })
        const node: NodeRecord = {
          id: uuid(),
          parentId: dest.id,
          name: await uniqueName(dest.id, file.name, 'file'),
          kind: 'file',
          mime: file.mime,
          size: blob.size,
          createdAt: now,
          modifiedAt: Number.isFinite(file.lastModified) ? Math.round(file.lastModified) : now,
          blobId,
          system: false,
          trash: null
        }
        await storage.nodes.put(node)
        nodes.push(node)
      }
      return nodes
    })
    for (const node of created) notify('create', node)
    return created
  },

  async getObjectUrl(path) {
    const url = URL.createObjectURL(await fs.readFile(path))
    return { url, revoke: () => URL.revokeObjectURL(url) }
  },

  async pathOf(nodeId) {
    const names: string[] = []
    let current = await getNode(nodeId)
    while (current.parentId !== null) {
      names.unshift(current.name)
      current = await getNode(current.parentId)
    }
    return `/${names.join('/')}`
  },

  usage: () => storage.nodes.usage()
}
