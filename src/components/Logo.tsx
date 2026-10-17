import { Link } from 'react-router-dom'
import { cx } from '@/lib/cx'

/**
 * The brand mark is a tiny seat grid: the product's signature element, reused in the
 * hero, library cards and the seat page. Filled = taken, outlined = free, one accent seat.
 */
const PATTERN = [1, 0, 1, 0, 1, 1, 1, 1, 0] // 3 x 3

export function SeatMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cx('size-7', className)}>
      {PATTERN.map((filled, i) => {
        const x = (i % 3) * 8 + 1
        const y = Math.floor(i / 3) * 8 + 1
        const accent = i === 4
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={6}
            height={6}
            rx={1.6}
            className={
              filled
                ? accent
                  ? 'fill-accent'
                  : 'fill-primary'
                : 'fill-primary-soft stroke-primary'
            }
            strokeWidth={filled ? 0 : 1.2}
          />
        )
      })}
    </svg>
  )
}

export function Logo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      aria-label="StudySeat home"
      className={cx('inline-flex items-center gap-2 rounded-control text-lg font-semibold tracking-tight', className)}
    >
      <SeatMark />
      StudySeat
    </Link>
  )
}
