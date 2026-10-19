import { useId, type InputHTMLAttributes, type Ref } from 'react'
import './TextField.css'

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label?: string
  /** Mensaje de error; marca el campo como inválido. */
  error?: string | null
  ref?: Ref<HTMLInputElement>
}

export function TextField({ label, error, className, ref, ...rest }: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <div className={['os-text-field', className].filter(Boolean).join(' ')}>
      {label ? (
        <label className="os-text-field__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <input
        ref={ref}
        id={id}
        className="os-text-field__input"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...rest}
      />
      {error ? (
        <p id={errorId} className="os-text-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
