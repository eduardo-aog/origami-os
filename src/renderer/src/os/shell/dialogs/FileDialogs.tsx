import { useState } from 'react'
import { Button, FileBrowser, type FileBrowserState } from '@os/ui'
import { dialogs, type DialogRequest } from '../../kernel/dialogs'
import { fs, joinPath, validateNodeName } from '../../kernel/fs'
import { DialogFrame } from './DialogFrame'

type Of<K extends DialogRequest['kind']> = Extract<DialogRequest, { kind: K }>

export function OpenFileDialog({ request }: { request: Of<'openFile'> }) {
  const { startPath, extensions, multiple, folders } = request.options
  const [state, setState] = useState<FileBrowserState | null>(null)

  // Al elegir carpetas, sin selección se elige la carpeta que se está mostrando.
  const result = state === null ? [] : state.selection.length > 0 ? state.selection : folders ? [state.path] : []
  const cancel = () => dialogs.settle(request, null)
  const accept = () => {
    if (result.length > 0) dialogs.settle(request, result)
  }

  return (
    <DialogFrame
      title={folders ? 'Elegir carpeta' : multiple ? 'Abrir archivos' : 'Abrir archivo'}
      wide
      onCancel={cancel}
      onSubmit={accept}
      actions={
        <>
          <Button onClick={cancel}>Cancelar</Button>
          <Button variant="primary" disabled={result.length === 0} onClick={accept}>
            {folders ? 'Elegir' : 'Abrir'}
          </Button>
        </>
      }
    >
      <div className="dialog__browser">
        <FileBrowser
          {...(startPath ? { startPath } : {})}
          {...(extensions ? { extensions } : {})}
          {...(multiple ? { multiple } : {})}
          {...(folders ? { folders } : {})}
          onChange={setState}
          onActivate={(path) => dialogs.settle(request, [path])}
        />
      </div>
    </DialogFrame>
  )
}

export function SaveFileDialog({ request }: { request: Of<'saveFile'> }) {
  const { startPath, defaultName = '', extensions } = request.options
  const [state, setState] = useState<FileBrowserState | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [replacing, setReplacing] = useState<string | null>(null)

  const cancel = () => dialogs.settle(request, null)

  async function accept() {
    if (state === null) return
    let name = state.name.trim()
    const nameProblem = validateNodeName(name)
    if (nameProblem) {
      setProblem(nameProblem)
      return
    }
    const defaultExtension = extensions?.[0]?.replace(/^\./, '')
    if (defaultExtension && !name.includes('.')) name = `${name}.${defaultExtension}`
    const path = joinPath(state.path, name)
    try {
      const existing = await fs.stat(path)
      if (existing.kind === 'folder') {
        setProblem(`"${name}" es una carpeta.`)
        return
      }
      setReplacing(path)
    } catch {
      dialogs.settle(request, path)
    }
  }

  return (
    <DialogFrame
      title="Guardar como"
      wide
      {...(replacing !== null
        ? { message: `Ya existe "${replacing.slice(replacing.lastIndexOf('/') + 1)}". ¿Quieres reemplazarlo? Se perderá su contenido actual.` }
        : problem
          ? { message: problem }
          : {})}
      onCancel={replacing !== null ? () => setReplacing(null) : cancel}
      onSubmit={replacing !== null ? undefined : () => void accept()}
      actions={
        replacing !== null ? (
          <>
            <Button autoFocus onClick={() => setReplacing(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => dialogs.settle(request, replacing)}>
              Reemplazar
            </Button>
          </>
        ) : (
          <>
            <Button onClick={cancel}>Cancelar</Button>
            <Button variant="primary" disabled={state === null || state.name.trim() === ''} onClick={() => void accept()}>
              Guardar
            </Button>
          </>
        )
      }
    >
      <div className="dialog__browser">
        <FileBrowser
          mode="save"
          {...(startPath ? { startPath } : {})}
          {...(extensions ? { extensions } : {})}
          defaultName={defaultName}
          onChange={(next) => {
            setState(next)
            setProblem(null)
          }}
          onActivate={(path) => setReplacing(path)}
        />
      </div>
    </DialogFrame>
  )
}
