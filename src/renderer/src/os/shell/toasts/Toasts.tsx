import { useEffect, useSyncExternalStore } from 'react'
import { getApp } from '../../kernel/apps'
import { launchApp } from '../../kernel/apps/launcher'
import { notifications, type NotificationItem } from '../../kernel/notifications'
import './Toasts.css'

/** Cuánto tarda en desaparecer un aviso emergente. */
const TOAST_DURATION_MS = 5000

function Toast({ item }: { item: NotificationItem }) {
  const app = getApp(item.appId)

  useEffect(() => {
    const timer = setTimeout(() => notifications.dismiss(item.id), TOAST_DURATION_MS)
    return () => clearTimeout(timer)
  }, [item.id])

  function open() {
    notifications.dismiss(item.id)
    launchApp(item.appId, item.launchArgs)
  }

  return (
    <button type="button" className="toast" onClick={open}>
      {app ? <img className="toast__icon" src={app.iconUrl} width={36} height={36} alt="" draggable={false} /> : null}
      <span className="toast__text">
        <span className="toast__title">{item.title}</span>
        {item.body ? <span className="toast__body">{item.body}</span> : null}
      </span>
    </button>
  )
}

/** Avisos emergentes arriba a la derecha. Al hacer clic se abre la app con los `launchArgs` del aviso. */
export function Toasts() {
  const items = useSyncExternalStore(
    (onChange) => notifications.subscribe(onChange),
    () => notifications.list()
  )
  return (
    <div className="toasts" aria-live="polite">
      {items.map((item) => (
        <Toast key={item.id} item={item} />
      ))}
    </div>
  )
}
