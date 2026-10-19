import type { ReactNode } from 'react'
import './SegmentedControl.css'

export interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string; icon?: ReactNode }[]
  disabled?: boolean
  'aria-label'?: string
}

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  disabled,
  'aria-label': ariaLabel
}: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="os-segmented">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          disabled={disabled}
          className="os-segmented__option"
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  )
}
