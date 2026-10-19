import type { NodeRecord } from '../storage/types'

export type FsNode = NodeRecord

export type FsErrorCode = 'ENOENT' | 'EEXIST' | 'ENOTDIR' | 'EISDIR' | 'EINVAL' | 'EPERM' | 'ENOTEMPTY'

/** Error del sistema de archivos. `code` sigue la convención Unix; `message` está en español. */
export class FsError extends Error {
  readonly code: FsErrorCode

  constructor(code: FsErrorCode, message: string) {
    super(message)
    this.name = 'FsError'
    this.code = code
  }
}

export interface FsApi {
  stat(path: string): Promise<FsNode>
  /** Excluye nodos en papelera y ocultos (nombre con '.'). */
  list(path: string): Promise<FsNode[]>
  exists(path: string): Promise<boolean>
  readFile(path: string): Promise<Blob>
  readText(path: string): Promise<string>
  writeFile(path: string, data: Blob | string, opts?: { overwrite?: boolean; mime?: string }): Promise<FsNode>
  mkdir(path: string, opts?: { recursive?: boolean }): Promise<FsNode>
  rename(path: string, newName: string): Promise<FsNode>
  move(path: string, destDir: string): Promise<FsNode>
  /** Recursivo para carpetas. */
  copy(path: string, destDir: string): Promise<FsNode>
  duplicate(path: string): Promise<FsNode>
  trash(path: string): Promise<void>
  listTrash(): Promise<FsNode[]>
  /** Si el padre original ya no existe, restaura en "~". */
  restore(nodeId: string): Promise<FsNode>
  deletePermanently(nodeId: string): Promise<void>
  emptyTrash(): Promise<void>
  importFromHost(destDir: string, opts?: { multiple?: boolean }): Promise<FsNode[]>
  getObjectUrl(path: string): Promise<{ url: string; revoke(): void }>
  pathOf(nodeId: string): Promise<string>
  usage(): Promise<{ bytes: number; files: number }>
}
