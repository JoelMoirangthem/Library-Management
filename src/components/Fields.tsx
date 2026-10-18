import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cx } from '@/lib/cx'

/**
 * Form fields. Visible label above the control (never placeholder-only), hint below,
 * error right under the field in words. 16px text on touch so iOS doesn't zoom on focus;
 * tighter (14px, 36px tall) on pointer devices.
 */

const control =
  'block w-full min-h-11 pointer-fine:min-h-9 rounded-control border bg-surface px-3 py-2 text-base pointer-fine:text-sm text-ink ' +
  'placeholder:text-ink-muted/70 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted'

function borderFor(error?: string) {
  return error ? 'border-danger' : 'border-border-strong'
}

type Shared = { label: string; hint?: string; error?: string; className?: string }

function Frame({
  id,
  label,
  hint,
  error,
  className,
  children,
}: Shared & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

const describedBy = (id: string, hint?: string, error?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined

export function TextField({
  label,
  hint,
  error,
  className,
  ...rest
}: Shared & Omit<InputHTMLAttributes<HTMLInputElement>, 'className'>) {
  const id = useId()
  return (
    <Frame id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(control, borderFor(error))}
        {...rest}
      />
    </Frame>
  )
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: Shared & Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'>) {
  const id = useId()
  return (
    <Frame id={id} label={label} hint={hint} error={error} className={className}>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(control, borderFor(error), 'cursor-pointer')}
        {...rest}
      >
        {children}
      </select>
    </Frame>
  )
}

export function TextAreaField({
  label,
  hint,
  error,
  className,
  ...rest
}: Shared & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>) {
  const id = useId()
  return (
    <Frame id={id} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cx(control, borderFor(error))}
        {...rest}
      />
    </Frame>
  )
}

/** A checkbox styled as a toggle chip, used for amenity pickers. */
export function ChipCheckbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      className={cx(
        'inline-flex min-h-11 pointer-fine:min-h-9 cursor-pointer select-none items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
        checked
          ? 'border-primary bg-primary-soft text-primary-ink'
          : 'border-border-strong bg-surface text-ink hover:bg-canvas',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="checkbox"
        className="size-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}
