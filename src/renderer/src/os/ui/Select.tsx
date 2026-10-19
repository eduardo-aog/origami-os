import { ChevronsUpDown } from 'lucide-react'
import { useId } from 'react'
import './Select.css'

export interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  label?: string
  disabled?: boolean
  'aria-label'?: string
}

export function Select({ value, onChange, options, label, disabled, 'aria-label': ariaLabel }: SelectProps) {
  const id = useId()
  return (
    <div className="os-select">
      {label ? (
        <label className="os-select__label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="os-select__control">
        <select
          id={id}
          className="os-select__input"
          value={value}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronsUpDown className="os-select__caret" size={14} aria-hidden="true" />
      </div>
    </div>
  )
}
