import { osConfig } from '../config'
import { storage, type NodeRecord } from '../storage'
import { mimeFromFileName } from './mime'
import { ROOT_ID, TRASH_ID, TRASH_NAME, USERS_DIR } from './paths'

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
 * Crea la raíz, la papelera y el árbol de carpetas del usuario (sección 4.3).
 * Lo llama el asistente de primer arranque, dentro de su transacción.
 */
export async function createInitialTree(userName: string): Promise<void> {
  const usersId = crypto.randomUUID()
  const homeId = crypto.randomUUID()

  await storage.nodes.put(folder(ROOT_ID, null, ''))
  await storage.nodes.put(folder(TRASH_ID, ROOT_ID, TRASH_NAME))
  await storage.nodes.put(folder(usersId, ROOT_ID, USERS_DIR))
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
