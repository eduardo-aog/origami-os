/** API pública de diálogos (sección 4.9). */
export interface DialogsApi {
  alert(o: { title: string; message?: string }): Promise<void>
  confirm(o: {
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    destructive?: boolean
  }): Promise<boolean>
  prompt(o: {
    title: string
    message?: string
    defaultValue?: string
    validate?: (value: string) => string | null
  }): Promise<string | null>
  choose<T extends string>(o: {
    title: string
    message?: string
    options: { value: T; label: string; destructive?: boolean }[]
  }): Promise<T | null>
  openFile(o?: {
    startPath?: string
    extensions?: string[]
    multiple?: boolean
    folders?: boolean
  }): Promise<string[] | null>
  saveFile(o?: { startPath?: string; defaultName?: string; extensions?: string[] }): Promise<string | null>
  /** Ficha de "Información" de un archivo o carpeta. */
  info(nodeId: string): Promise<void>
}

/** Además de la API pública, el sistema usa diálogos propios. */
export interface ScopedDialogs extends DialogsApi {
  /** El aviso de cambios sin guardar de la sección 4.9. */
  unsaved(documentName: string): Promise<'save' | 'discard' | 'cancel'>
  about(appId: string): Promise<void>
}

export type DialogScope = { type: 'window'; windowId: string } | { type: 'system' }

type Opts<K extends keyof DialogsApi> = Parameters<DialogsApi[K]>[0]
type Result<K extends keyof DialogsApi> = Awaited<ReturnType<DialogsApi[K]>>

interface DialogKinds {
  alert: { options: Opts<'alert'>; result: void }
  confirm: { options: Opts<'confirm'>; result: boolean }
  prompt: { options: Opts<'prompt'>; result: Result<'prompt'> }
  choose: {
    options: { title: string; message?: string; options: { value: string; label: string; destructive?: boolean }[] }
    result: string | null
  }
  openFile: { options: NonNullable<Opts<'openFile'>>; result: Result<'openFile'> }
  saveFile: { options: NonNullable<Opts<'saveFile'>>; result: Result<'saveFile'> }
  unsaved: { options: { documentName: string }; result: 'save' | 'discard' | 'cancel' }
  about: { options: { appId: string }; result: void }
  info: { options: { nodeId: string }; result: void }
}

export type DialogKind = keyof DialogKinds
export type DialogOptions<K extends DialogKind> = DialogKinds[K]['options']
export type DialogResult<K extends DialogKind> = DialogKinds[K]['result']

export type DialogRequest = {
  [K in DialogKind]: {
    id: string
    scope: DialogScope
    kind: K
    options: DialogOptions<K>
    resolve: (result: DialogResult<K>) => void
  }
}[DialogKind]
