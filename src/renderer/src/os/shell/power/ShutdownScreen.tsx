import './ShutdownScreen.css'

export function ShutdownScreen() {
  return (
    <div className="shutdown" role="status">
      <div className="shutdown__spinner" aria-hidden="true" />
      <p className="shutdown__text">Apagando…</p>
    </div>
  )
}
