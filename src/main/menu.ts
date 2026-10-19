import { Menu, type MenuItemConstructorOptions } from 'electron'
import osConfig from '../renderer/src/system/os.config.json'

/**
 * La barra de menú nativa queda oculta. En macOS el menú no puede quitarse del todo:
 * sin un menú de Edición con roles, Cmd+C / Cmd+V no llegan a los campos de texto.
 */
export function installApplicationMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }

  const template: MenuItemConstructorOptions[] = [
    { label: osConfig.name, submenu: [{ role: 'quit', label: 'Salir' }] },
    {
      label: 'Edición',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
