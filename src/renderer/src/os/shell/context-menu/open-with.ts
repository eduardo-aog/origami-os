import type { MenuItem } from '@os/ui'
import { extensionOf, getAppsForFile, openFile, resolveDefaultApp, setDefaultApp } from '../../kernel/apps/launcher'

/** "Abrir con…": las apps que pueden abrir el archivo y, aparte, "Elegir siempre esta app". */
export function openWithItem(path: string): MenuItem {
  const candidates = getAppsForFile(path)
  const extension = extensionOf(path)
  const defaultId = resolveDefaultApp(extension)?.manifest.id
  return {
    label: 'Abrir con…',
    disabled: candidates.length === 0,
    submenu: [
      ...candidates.map((app) => ({
        label: app.name,
        checked: app.id === defaultId,
        onSelect: () => void openFile(path, app.id)
      })),
      { separator: true },
      {
        label: 'Elegir siempre esta app',
        disabled: extension === '',
        submenu: candidates.map((app) => ({
          label: app.name,
          checked: app.id === defaultId,
          onSelect: () => {
            void setDefaultApp(extension, app.id).then(() => openFile(path, app.id))
          }
        }))
      }
    ]
  }
}
