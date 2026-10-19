import { useEffect, useState } from 'react'
import { Button, FileIcon, describeKind, formatBytes, formatDateTime } from '@os/ui'
import { getApp } from '../../kernel/apps'
import { dialogs, type DialogRequest } from '../../kernel/dialogs'
import { fs, type FsNode } from '../../kernel/fs'
import { DialogFrame } from './DialogFrame'

type Of<K extends DialogRequest['kind']> = Extract<DialogRequest, { kind: K }>

/** "Acerca de <App>": ícono, portada, nombre, descripción, versión y autor, leídos del manifiesto. */
export function AboutDialog({ request }: { request: Of<'about'> }) {
  const app = getApp(request.options.appId)
  const close = () => dialogs.settle(request, undefined)
  // Si la app ya no existe no hay nada que mostrar: el diálogo se cierra solo.
  useEffect(() => {
    if (!app) dialogs.settle(request, undefined)
  }, [app, request])
  if (!app) return null
  const { manifest, iconUrl, coverUrl } = app
  return (
    <DialogFrame
      title={`Acerca de ${manifest.name}`}
      onCancel={close}
      onSubmit={close}
      actions={
        <Button variant="primary" autoFocus onClick={close}>
          Cerrar
        </Button>
      }
    >
      <div className="about">
        {coverUrl ? <img className="about__cover" src={coverUrl} alt="" draggable={false} /> : null}
        <img className="about__icon" src={iconUrl} width={72} height={72} alt="" draggable={false} />
        <p className="about__name">{manifest.name}</p>
        <p className="about__description">{manifest.description}</p>
        <p className="about__meta">
          Versión {manifest.version}
          {manifest.author ? ` · ${manifest.author}` : ''}
        </p>
      </div>
    </DialogFrame>
  )
}

interface NodeInfo {
  node: FsNode
  path: string
}

/** "Información" de un archivo o carpeta. */
export function InfoDialog({ request }: { request: Of<'info'> }) {
  const [info, setInfo] = useState<NodeInfo | null>(null)
  const close = () => dialogs.settle(request, undefined)

  useEffect(() => {
    let active = true
    fs.pathOf(request.options.nodeId)
      .then(async (path) => ({ path, node: await fs.stat(path) }))
      .then((loaded) => active && setInfo(loaded))
      .catch(() => active && close())
    return () => {
      active = false
    }
    // `close` solo depende de `request`, que no cambia durante la vida del diálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.options.nodeId])

  if (!info) return null
  const { node, path } = info
  const rows: [string, string][] = [
    ['Tipo', describeKind(node)],
    ...(node.kind === 'file' ? ([['Tamaño', formatBytes(node.size)]] as [string, string][]) : []),
    ['Ubicación', path.slice(0, path.lastIndexOf('/')) || '/'],
    ['Creado', formatDateTime(node.createdAt)],
    ['Modificado', formatDateTime(node.modifiedAt)]
  ]
  return (
    <DialogFrame
      title={node.name}
      onCancel={close}
      onSubmit={close}
      actions={
        <Button variant="primary" autoFocus onClick={close}>
          Cerrar
        </Button>
      }
    >
      <div className="info">
        <FileIcon kind={node.kind} mime={node.mime} system={node.system} size={48} />
        <dl className="info__list">
          {rows.map(([label, value]) => (
            <div key={label} className="info__row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </DialogFrame>
  )
}
