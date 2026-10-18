import type { ReactNode } from 'react'
import { cx } from '@/lib/cx'

export type OperationalRowProps = {
  primary: ReactNode
  context?: ReactNode
  status?: ReactNode
  primaryAction?: ReactNode
  moreAction?: ReactNode
  mobileFooter?: ReactNode
  className?: string
}

/**
 * An operational record: a focused, stacked mobile record that becomes a dense desktop row.
 * Field order stays the same at every viewport, while callers provide the action controls.
 */
export function OperationalRow({
  primary,
  context,
  status,
  primaryAction,
  moreAction,
  mobileFooter,
  className,
}: OperationalRowProps) {
  const hasContext = context !== undefined && context !== null
  const hasStatus = status !== undefined && status !== null
  const hasPrimaryAction = primaryAction !== undefined && primaryAction !== null
  const hasMoreAction = moreAction !== undefined && moreAction !== null

  return (
    <div
      className={cx(
        'grid min-w-0 gap-3 border-b border-border p-4 last:border-b-0 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,auto)_auto_auto] sm:items-center sm:gap-4 sm:px-5',
        className,
      )}
    >
      <div className="min-w-0">{primary}</div>
      <div className={cx('min-w-0 text-sm text-ink-muted', !hasContext && 'hidden sm:block')}>{context}</div>
      <div className={cx('min-w-0 text-sm', !hasStatus && 'hidden sm:block')}>{status}</div>
      <div className={cx('justify-self-start sm:justify-self-end', !hasPrimaryAction && 'hidden sm:block')}>
        {primaryAction}
      </div>
      <div className={cx('justify-self-start sm:justify-self-end', !hasMoreAction && 'hidden sm:block')}>{moreAction}</div>
      {mobileFooter && <div className="border-t border-border pt-3 sm:hidden">{mobileFooter}</div>}
    </div>
  )
}
