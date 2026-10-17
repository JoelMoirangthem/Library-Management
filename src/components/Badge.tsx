import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'accent'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-border text-ink-muted',
  primary: 'bg-primary-soft text-primary-ink',
  success: 'bg-success-soft text-success-ink',
  warning: 'bg-warning-soft text-warning-ink',
  danger: 'bg-danger-soft text-danger-ink',
  accent: 'bg-accent-soft text-accent-ink',
}

/** Status pill. Always include text; colour is never the only signal. */
export function Badge({
  tone = 'neutral',
  icon,
  children,
  className,
}: {
  tone?: BadgeTone
  icon?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {icon && <span aria-hidden className="[&>svg]:size-3.5">{icon}</span>}
      {children}
    </span>
  )
}
