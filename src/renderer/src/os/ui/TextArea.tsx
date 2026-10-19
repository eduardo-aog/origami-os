import { useId, type Ref, type TextareaHTMLAttributes } from 'react'
import './TextArea.css'

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label?: string
  ref?: Ref<HTMLTextAreaElement>
}

export function TextArea({ label, className, ref, ...rest }: TextAreaProps) {
  const id = useId()
  return (
    <div className={['os-text-area', className].filter(Boolean).join(' ')}>
      {label ? (
        <label className="os-text-area__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <textarea ref={ref} id={id} className="os-text-area__input" {...rest} />
    </div>
  )
}
