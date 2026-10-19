import { useStore } from 'zustand'
import { dialogs, type DialogRequest, type DialogScope } from '.'

/** Diálogo que se está mostrando en un ámbito (una ventana o el sistema), si hay alguno. */
export function useActiveDialog(scope: DialogScope): DialogRequest | undefined {
  return useStore(dialogs, () => dialogs.active(scope))
}
