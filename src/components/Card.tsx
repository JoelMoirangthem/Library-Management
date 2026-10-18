import type { HTMLAttributes } from 'react'
import { cx } from '@/lib/cx'

/** The one container style: white surface, hairline border, large radius, one soft elevation step. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('min-w-0 rounded-card border border-border bg-surface shadow-card', className)} {...rest} />
}
