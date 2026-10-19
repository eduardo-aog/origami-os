import logoUrl from '@system/boot/logo.svg'
import { Button } from '@os/ui'
import { osConfig } from '../../kernel/config'
import { session } from '../../kernel/session'
import { useSession } from '../../kernel/session/hooks'
import './BootScreen.css'

export function BootScreen() {
  const bootStartedAt = useSession((state) => state.bootStartedAt)
  const bootError = useSession((state) => state.bootError)

  return (
    <div className="boot">
      <img className="boot__logo" src={logoUrl} alt="" draggable={false} />
      {bootError ? (
        <div className="boot__error" role="alert">
          <p>{bootError}</p>
          <Button onClick={() => void session.boot()}>Reintentar</Button>
        </div>
      ) : (
        <div className="boot__track" role="progressbar" aria-label="Iniciando">
          <div
            key={bootStartedAt}
            className="boot__fill"
            style={{ animationDuration: `${osConfig.bootDurationMs}ms` }}
          />
        </div>
      )}
    </div>
  )
}
