import type { PublicShift } from '@/domain/types'
import { cx } from '@/lib/cx'

type ShiftLike = Pick<PublicShift, 'id' | 'name' | 'totalSeats' | 'seatsLeft'>

const SEGMENTS = 20

function freeText(s: ShiftLike): { text: string; tone: string } {
  if (s.seatsLeft === 0) return { text: 'Full', tone: 'text-ink-muted' }
  if (s.seatsLeft <= 5) return { text: `${s.seatsLeft} free`, tone: 'text-warning-ink' }
  return { text: `${s.seatsLeft} free`, tone: 'text-primary-ink' }
}

/**
 * One row per shift: its name, a bar of seats (filled = taken) and the plain-text count.
 * Always renders exactly `slots` rows (missing ones are invisible placeholders), so every
 * card that uses it has the same height and every label, bar and number sits at the same
 * x/y position, whether a library has one shift or three.
 */
export function ShiftBars({
  shifts,
  slots = 3,
  size = 'md',
  tinted = false,
  className,
}: {
  shifts: ShiftLike[]
  slots?: number
  size?: 'md' | 'lg'
  /** Each row gets its own soft background, so an empty slot stays empty instead of showing a blank strip. */
  tinted?: boolean
  className?: string
}) {
  const rows = shifts.slice(0, slots)
  const empty = Math.max(0, slots - rows.length)
  const rowH = size === 'lg' ? 'h-10' : 'h-7'
  const text = size === 'lg' ? 'text-sm' : 'text-xs'
  const cols = size === 'lg' ? 'grid-cols-[4.75rem_minmax(0,1fr)_3.5rem] sm:grid-cols-[6.5rem_minmax(0,1fr)_4.5rem]' : 'grid-cols-[4.75rem_minmax(0,1fr)_3.5rem]'

  return (
    <ul className={cx(tinted ? 'space-y-1.5' : 'space-y-1', className)} aria-label="Seats free by shift">
      {rows.map((s) => {
        const taken = s.totalSeats === 0 ? 0 : Math.round(((s.totalSeats - s.seatsLeft) / s.totalSeats) * SEGMENTS)
        const free = freeText(s)
        return (
          <li key={s.id} className={cx('grid items-center gap-2', cols, rowH, tinted && 'rounded-control bg-primary-soft px-3')}>
            <span className={cx('truncate font-medium text-primary-ink', text)} title={s.name}>
              {s.name}
            </span>
            <span aria-hidden className="flex min-w-0 gap-[3px]">
              {Array.from({ length: SEGMENTS }, (_, i) => (
                <span
                  key={i}
                  className={cx(
                    'flex-1 rounded-[3px] border border-primary',
                    size === 'lg' ? 'h-3.5' : 'h-3',
                    i < taken ? 'bg-primary' : 'bg-surface',
                  )}
                />
              ))}
            </span>
            <span className={cx('text-right font-semibold tabular-nums', text, free.tone)}>{free.text}</span>
          </li>
        )
      })}
      {Array.from({ length: empty }, (_, i) => (
        <li key={`empty-${i}`} aria-hidden className={rowH} />
      ))}
    </ul>
  )
}

/**
 * Cover art for a library without photos (used big on the detail page). It is the same
 * ShiftBars block as on the cards, just larger, so the two always agree.
 */
export function LibraryArt({
  shifts,
  className,
}: {
  shifts: ShiftLike[]
  className?: string
}) {
  return (
    <div className={cx('flex flex-col justify-center bg-primary-soft p-4 sm:p-8', className)}>
      <ShiftBars shifts={shifts} size="lg" className="mx-auto w-full max-w-2xl" />
    </div>
  )
}
