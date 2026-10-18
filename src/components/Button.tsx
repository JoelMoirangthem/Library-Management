import type { ButtonHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cx } from '@/lib/cx'

export type ButtonVariant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  /** Shows a spinner and blocks clicks. Keeps the label so the button doesn't change width. */
  loading?: boolean
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-surface text-ink border border-border-strong hover:bg-canvas',
  accent: 'bg-accent text-white hover:bg-accent-hover',
  danger: 'bg-danger text-white hover:bg-danger-ink',
  ghost: 'text-primary hover:bg-primary-soft',
}

/**
 * Class string for anything that should look like a button, e.g. a router <Link>:
 *   <Link to="/x" className={buttonStyles('primary')}>Go</Link>
 * 44px minimum height on touch (used one-handed on phones); 36px on pointer devices,
 * which is the desktop control standard and stops the UI reading as oversized.
 */
export function buttonStyles(variant: ButtonVariant = 'primary', extra?: string) {
  // Tailwind can't tell which of two conflicting utilities you meant, so the defaults step aside
  // when the caller supplies their own horizontal padding or hides the button.
  const customPadding = /(^|\s)px-/.test(extra ?? '')
  const hidden = /(^|\s)hidden(\s|$)/.test(extra ?? '')
  return cx(
    !hidden && 'inline-flex',
    'min-h-11 pointer-fine:min-h-9 cursor-pointer items-center justify-center gap-2 rounded-control',
    !customPadding && 'px-4',
    'text-base pointer-fine:text-sm font-medium transition-colors duration-150 active:translate-y-px',
    variants[variant],
    extra,
  )
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles(
        variant,
        cx(
          // Loading keeps full contrast (it's busy, not unavailable); only truly disabled dims.
          loading ? 'cursor-progress' : 'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        ),
      )}
      {...rest}
    >
      {loading && <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />}
      {children}
    </button>
  )
}
