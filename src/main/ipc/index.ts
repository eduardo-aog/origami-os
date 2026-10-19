import { registerAuthIpc } from './auth'
import { registerFilesIpc } from './files'
import { registerPowerIpc } from './power'

export function registerIpc(): void {
  registerFilesIpc()
  registerAuthIpc()
  registerPowerIpc()
}
