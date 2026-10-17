import type { PublicShift } from '@/domain/types'
import { cx } from '@/lib/cx'

/**
 * Cover art for a library without photos: one row of tiny seats per shift, filled = taken.
 * It tells the story the photo can't ("Morning is full, Evening is open") and never looks
 * like a missing image. Decorative: the same numbers are written as text beside it.
 */
export function LibraryArt({
  shifts,
  className,
}: {
  shifts: Pick<PublicShift, 'id' | 'name' | 'totalSeats' | 'seatsLeft'>[]
  className?: string
}) {
  const rows = shifts.slice(0, 3)
  const COLS = 20
  return (
    <div
      aria-hidden
      className={cx(
        'flex flex-col justify-center gap-2.5 bg-primary-soft px-4 py-3',
        className,
      )}
    >
      {rows.map((s) => {
        const taken = s.totalSeats === 0 ? 0 : Math.round(((s.totalSeats - s.seatsLeft) / s.totalSeats) * COLS)
        return (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-center text-xs font-semibold text-primary-ink">
              {s.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="flex flex-1 gap-[3px]">
              {Array.from({ length: COLS }, (_, i) => (
                <span
                  key={i}
                  className={cx(
                    'h-3 flex-1 rounded-[3px] border border-primary',
                    i < taken ? 'bg-primary' : 'bg-surface/70',
                  )}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
