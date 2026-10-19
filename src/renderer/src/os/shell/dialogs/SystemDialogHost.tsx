import { useActiveDialog } from '../../kernel/dialogs/hooks'
import { DialogContent } from './DialogContent'
import './Dialogs.css'

/** Diálogos modales de sistema: centrados, con el fondo atenuado, y bloquean todo. */
export function SystemDialogHost() {
  const request = useActiveDialog({ type: 'system' })
  if (!request) return null
  return (
    <div className="system-dialog-backdrop">
      <div className="system-dialog" key={request.id}>
        <DialogContent request={request} />
      </div>
    </div>
  )
}
