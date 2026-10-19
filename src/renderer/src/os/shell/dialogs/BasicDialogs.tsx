import { useState } from 'react'
import { Button, TextField } from '@os/ui'
import { dialogs, type DialogRequest } from '../../kernel/dialogs'
import { DialogFrame } from './DialogFrame'

type Of<K extends DialogRequest['kind']> = Extract<DialogRequest, { kind: K }>

export function AlertDialog({ request }: { request: Of<'alert'> }) {
  const close = () => dialogs.settle(request, undefined)
  return (
    <DialogFrame
      title={request.options.title}
      {...(request.options.message ? { message: request.options.message } : {})}
      onCancel={close}
      onSubmit={close}
      actions={
        <Button variant="primary" autoFocus onClick={close}>
          Aceptar
        </Button>
      }
    />
  )
}

export function ConfirmDialog({ request }: { request: Of<'confirm'> }) {
  const { title, message, confirmLabel = 'Aceptar', cancelLabel = 'Cancelar', destructive } = request.options
  const accept = () => dialogs.settle(request, true)
  const cancel = () => dialogs.settle(request, false)
  return (
    <DialogFrame
      title={title}
      {...(message ? { message } : {})}
      onCancel={cancel}
      onSubmit={accept}
      actions={
        <>
          <Button onClick={cancel}>{cancelLabel}</Button>
          <Button variant={destructive ? 'danger' : 'primary'} autoFocus onClick={accept}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  )
}

export function PromptDialog({ request }: { request: Of<'prompt'> }) {
  const { title, message, defaultValue = '', validate } = request.options
  const [value, setValue] = useState(defaultValue)
  const problem = validate ? validate(value) : null
  const accept = () => {
    if (!problem) dialogs.settle(request, value)
  }
  const cancel = () => dialogs.settle(request, null)
  return (
    <DialogFrame
      title={title}
      {...(message ? { message } : {})}
      onCancel={cancel}
      onSubmit={accept}
      actions={
        <>
          <Button onClick={cancel}>Cancelar</Button>
          <Button variant="primary" disabled={problem !== null} onClick={accept}>
            Aceptar
          </Button>
        </>
      }
    >
      <TextField
        aria-label={title}
        autoFocus
        autoComplete="off"
        value={value}
        error={value !== defaultValue ? problem : null}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.target.select()}
      />
    </DialogFrame>
  )
}

export function ChooseDialog({ request }: { request: Of<'choose'> }) {
  const { title, message, options } = request.options
  const cancel = () => dialogs.settle(request, null)
  return (
    <DialogFrame
      title={title}
      {...(message ? { message } : {})}
      onCancel={cancel}
      actions={<Button onClick={cancel}>Cancelar</Button>}
    >
      <div className="dialog__choices">
        {options.map((option) => (
          <Button
            key={option.value}
            variant={option.destructive ? 'danger' : 'secondary'}
            onClick={() => dialogs.settle(request, option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </DialogFrame>
  )
}

/** El aviso único de cambios sin guardar (sección 4.9). */
export function UnsavedDialog({ request }: { request: Of<'unsaved'> }) {
  const answer = (value: 'save' | 'discard' | 'cancel') => () => dialogs.settle(request, value)
  return (
    <DialogFrame
      title={`¿Guardar los cambios de "${request.options.documentName}"?`}
      message="Si no los guardas, se perderán."
      onCancel={answer('cancel')}
      onSubmit={answer('save')}
      actions={
        <>
          <Button onClick={answer('discard')}>No guardar</Button>
          <Button onClick={answer('cancel')}>Cancelar</Button>
          <Button variant="primary" autoFocus onClick={answer('save')}>
            Guardar
          </Button>
        </>
      }
    />
  )
}
