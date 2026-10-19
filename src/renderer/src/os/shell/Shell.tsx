import { useEffect } from 'react'
import { session } from '../kernel/session'
import { useSession } from '../kernel/session/hooks'
import { initWindows } from '../kernel/windows'
import { BootScreen } from './boot/BootScreen'
import { Desktop } from './desktop/Desktop'
import { SystemDialogHost } from './dialogs/SystemDialogHost'
import { Dock } from './dock/Dock'
import { Launchpad } from './launchpad/Launchpad'
import { LoginScreen } from './login/LoginScreen'
import { Menubar } from './menubar/Menubar'
import { ShutdownScreen } from './power/ShutdownScreen'
import { SetupWizard } from './setup/SetupWizard'
import { useThemeSync } from './theme/useThemeSync'
import { Toasts } from './toasts/Toasts'
import { WindowLayer } from './window-frame/WindowLayer'
import './Shell.css'

/** Raíz del shell: elige qué pantalla mostrar según la fase de la sesión. */
export function Shell() {
  useThemeSync()
  const phase = useSession((state) => state.phase)

  useEffect(() => {
    initWindows()
    void session.boot()
  }, [])

  const sessionOpen = phase === 'desktop' || phase === 'locked'

  return (
    <>
      {/* Con la pantalla bloqueada el escritorio y las ventanas siguen ahí, pero inertes. */}
      {sessionOpen ? (
        <div className="shell-session" inert={phase === 'locked'}>
          <Desktop />
          <WindowLayer />
          <Menubar />
          <Dock />
          <Launchpad />
          <Toasts />
          <SystemDialogHost />
        </div>
      ) : null}
      {phase === 'boot' ? <BootScreen /> : null}
      {phase === 'setup' ? <SetupWizard /> : null}
      {phase === 'login' || phase === 'locked' ? <LoginScreen /> : null}
      {phase === 'shutdown' ? <ShutdownScreen /> : null}
    </>
  )
}
