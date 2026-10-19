import { osConfig } from '../config'
import { storage, type NodeRecord } from '../storage'
import { mimeFromFileName } from './mime'
import { ROOT_ID, TRASH_ID, TRASH_NAME, USERS_DIR } from './paths'
import { FsError } from './types'

function folder(id: string, parentId: string | null, name: string): NodeRecord {
  const now = Date.now()
  return {
    id,
    parentId,
    name,
    kind: 'folder',
    mime: '',
    size: 0,
    createdAt: now,
    modifiedAt: now,
    blobId: null,
    system: true,
    trash: null
  }
}

function welcomeText(userName: string): string {
  return [
    `¡Hola, ${userName}! Te damos la bienvenida a ${osConfig.name}.`,
    '',
    'Esta es tu carpeta de Documentos. Aquí puedes guardar tus archivos de texto,',
    'y todo lo que crees se conserva aunque cierres la aplicación.',
    ''
  ].join('\n')
}

/**
 * Crea la raíz, la papelera y la carpeta `Usuarios` (sección 4.3). Se hace una sola vez, en el primer
 * arranque, dentro de la transacción del asistente.
 */
export async function createSystemTree(): Promise<void> {
  await storage.nodes.put(folder(ROOT_ID, null, ''))
  await storage.nodes.put(folder(TRASH_ID, ROOT_ID, TRASH_NAME))
  await storage.nodes.put(folder(crypto.randomUUID(), ROOT_ID, USERS_DIR))
}

/**
 * Crea la carpeta de inicio de una cuenta con sus carpetas estándar y `Documentos/Bienvenida.txt`.
 * Se llama dentro de la transacción que da de alta la cuenta. Falla si ya hay una carpeta con ese nombre.
 */
export async function createUserHome(userName: string): Promise<void> {
  const users = await storage.nodes.getByName(ROOT_ID, USERS_DIR)
  if (!users) throw new FsError('ENOENT', 'Todavía no existe la carpeta de usuarios.')
  if (await storage.nodes.getByName(users.id, userName)) {
    throw new FsError('EEXIST', 'Ya existe un usuario con ese nombre.')
  }
  const usersId = users.id
  const homeId = crypto.randomUUID()
  await storage.nodes.put(folder(homeId, usersId, userName))

  const create = async (parentId: string, name: string): Promise<string> => {
    const node = folder(crypto.randomUUID(), parentId, name)
    await storage.nodes.put(node)
    return node.id
  }

  await create(homeId, 'Escritorio')
  const documentsId = await create(homeId, 'Documentos')
  await create(homeId, 'Descargas')
  const picturesId = await create(homeId, 'Imágenes')
  await create(picturesId, 'Cámara')
  const musicId = await create(homeId, 'Música')
  await create(musicId, 'Grabaciones')
  const videosId = await create(homeId, 'Videos')
  await create(videosId, 'Cámara')

  const text = welcomeText(userName)
  const blob = new Blob([text], { type: 'text/plain' })
  const blobId = crypto.randomUUID()
  const now = Date.now()
  await storage.blobs.put({ id: blobId, data: blob })
  await storage.nodes.put({
    id: crypto.randomUUID(),
    parentId: documentsId,
    name: 'Bienvenida.txt',
    kind: 'file',
    mime: mimeFromFileName('Bienvenida.txt'),
    size: blob.size,
    createdAt: now,
    modifiedAt: now,
    blobId,
    system: false,
    trash: null
  })
}
