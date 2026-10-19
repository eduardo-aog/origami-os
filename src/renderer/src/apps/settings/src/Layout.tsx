import type { ReactNode } from 'react'

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="settings__group">
      {title ? <h3 className="settings__group-title">{title}</h3> : null}
      <div className="settings__card">{children}</div>
    </section>
  )
}

export function Row({
  label,
  description,
  wide = false,
  children
}: {
  label: string
  description?: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <div className="settings__row">
      <div className="settings__row-text">
        <span className="settings__row-label">{label}</span>
        {description ? <span className="settings__row-description">{description}</span> : null}
      </div>
      <div className={`settings__row-control${wide ? ' settings__row-control--wide' : ''}`}>{children}</div>
    </div>
  )
}

export function Message({ tone, children }: { tone?: 'success' | 'error'; children: ReactNode }) {
  return (
    <p className={`settings__message${tone ? ` settings__message--${tone}` : ''}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  )
}
