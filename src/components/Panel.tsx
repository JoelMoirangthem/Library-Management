import type { ReactNode } from 'react'
import { Card } from '@/components/Card'
import { cx } from '@/lib/cx'

export type PanelProps = {
  title?: string
  action?: ReactNode
  children: ReactNode
  footer?: ReactNode
  className?: string
}

export function Panel({ title, action, children, footer, className }: PanelProps) {
  return (
    <Card className={cx('flex min-w-0 flex-col overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-4 sm:px-5">
          {title && <h2 className="text-lg font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      <div className="min-w-0 flex-1 p-4 sm:p-5">{children}</div>
      {footer && <div className="border-t border-border px-4 py-3 sm:px-5">{footer}</div>}
    </Card>
  )
}
