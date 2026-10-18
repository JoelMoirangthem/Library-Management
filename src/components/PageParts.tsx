import type { ReactNode } from 'react'
import { Card } from '@/components/Card'
import { cx } from '@/lib/cx'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  )
}

/** Dashboard number card. Values use tabular figures so columns of cards align. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: ReactNode
  tone?: 'default' | 'primary' | 'warning'
}) {
  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{label}</p>
        {icon && (
          <span
            aria-hidden
            className={cx(
              'flex size-9 items-center justify-center rounded-full [&>svg]:size-5',
              tone === 'primary' && 'bg-primary-soft text-primary-ink',
              tone === 'warning' && 'bg-warning-soft text-warning-ink',
              tone === 'default' && 'bg-canvas text-ink-muted',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-sm text-ink-muted">{hint}</p>}
    </Card>
  )
}
