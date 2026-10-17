import type { HTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

/** The one container style: white surface, hairline border, large radius. No shadow. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-card border border-border bg-surface', className)} {...rest} />
}
