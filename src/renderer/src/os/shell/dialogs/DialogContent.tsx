import type { DialogRequest } from '../../kernel/dialogs'
import { AlertDialog, ChooseDialog, ConfirmDialog, PromptDialog, UnsavedDialog } from './BasicDialogs'
import { OpenFileDialog, SaveFileDialog } from './FileDialogs'
import { AboutDialog, InfoDialog } from './InfoDialogs'

/** El diálogo que corresponde a cada tipo de petición. */
export function DialogContent({ request }: { request: DialogRequest }) {
  switch (request.kind) {
    case 'alert':
      return <AlertDialog request={request} />
    case 'confirm':
      return <ConfirmDialog request={request} />
    case 'prompt':
      return <PromptDialog request={request} />
    case 'choose':
      return <ChooseDialog request={request} />
    case 'openFile':
      return <OpenFileDialog request={request} />
    case 'saveFile':
      return <SaveFileDialog request={request} />
    case 'unsaved':
      return <UnsavedDialog request={request} />
    case 'about':
      return <AboutDialog request={request} />
    case 'info':
      return <InfoDialog request={request} />
  }
}
