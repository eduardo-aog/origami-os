import { useActiveDialog } from '../../kernel/dialogs/hooks'
import { DialogContent } from './DialogContent'
import './Dialogs.css'

/** Diálogos modales de ventana: una hoja que baja desde la barra de título y bloquea solo esa ventana. */
export function SheetHost({ windowId }: { windowId: string }) {
  const request = useActiveDialog({ type: 'window', windowId })
  if (!request) return null
  return (
    <div className="sheet-backdrop">
      <div className="sheet" key={request.id}>
        <DialogContent request={request} />
      </div>
    </div>
  )
}
