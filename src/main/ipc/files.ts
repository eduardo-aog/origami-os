import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { mimeFromFileName } from '../../shared/mime'
import {
  IPC_CHANNELS,
  type HostFile,
  type HostFileFilter,
  type ImportFromHostOptions
} from '../../shared/native-api'
import { assertTrustedSender } from './trust'

const EXTENSION_PATTERN = /^(\*|[A-Za-z0-9]+)$/

function parseFilters(value: unknown): HostFileFilter[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new TypeError('filters debe ser una lista')
  return value.map((item: unknown) => {
    if (typeof item !== 'object' || item === null) throw new TypeError('filtro inválido')
    const { name, extensions } = item as Record<string, unknown>
    if (typeof name !== 'string' || name.length === 0) throw new TypeError('filtro sin nombre')
    if (
      !Array.isArray(extensions) ||
      !extensions.every((ext) => typeof ext === 'string' && EXTENSION_PATTERN.test(ext))
    ) {
      throw new TypeError(`extensiones inválidas en el filtro "${name}"`)
    }
    return { name, extensions: extensions as string[] }
  })
}

function parseOptions(value: unknown): ImportFromHostOptions {
  if (value === undefined) return {}
  if (typeof value !== 'object' || value === null) throw new TypeError('opciones inválidas')
  const { multiple, filters } = value as Record<string, unknown>
  if (multiple !== undefined && typeof multiple !== 'boolean') {
    throw new TypeError('multiple debe ser booleano')
  }
  return { multiple, filters: parseFilters(filters) }
}

async function readHostFile(filePath: string): Promise<HostFile> {
  const [contents, info] = await Promise.all([readFile(filePath), stat(filePath)])
  // Se copia a un ArrayBuffer propio: el de `Buffer` puede ser un fragmento de un pool compartido.
  const data = new ArrayBuffer(contents.byteLength)
  new Uint8Array(data).set(contents)
  const name = basename(filePath)
  return { name, mime: mimeFromFileName(name), data, lastModified: info.mtimeMs }
}

export function registerFilesIpc(): void {
  ipcMain.handle(IPC_CHANNELS.filesImportFromHost, async (event, rawOptions: unknown) => {
    assertTrustedSender(event)
    const options = parseOptions(rawOptions)

    const dialogOptions: OpenDialogOptions = {
      properties: options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
      filters: options.filters
    }
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = window
      ? await dialog.showOpenDialog(window, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)

    if (result.canceled) return []
    return Promise.all(result.filePaths.map(readHostFile))
  })
}
