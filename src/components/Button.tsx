import type { ButtonHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  /** Shows a spinner and blocks clicks. Keeps the label so the button doesn't change width. */
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-hover',
  secondary: 'bg-surface text-ink border border-border-strong hover:bg-canvas',
  accent: 'bg-accent text-white hover:bg-accent-hover',
  danger: 'bg-danger text-white hover:bg-danger-ink',
  ghost: 'text-primary hover:bg-primary-soft',
}

/** 44px minimum height on every size: these are used one-handed on phones. */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={[
        'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control px-4',
        'text-base font-medium transition-colors duration-150',
        // Loading keeps full contrast (it's busy, not unavailable); only truly disabled dims.
        loading ? 'cursor-progress' : 'disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" />}
      {children}
    </button>
  )
}
