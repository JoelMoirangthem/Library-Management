import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { cx } from '@/lib/cx'

/**
 * The landing signature: a large seat grid that fills in once on load.
 *
 * It reuses the exact look of the real SeatGrid states (same radius, borders, soft/solid
 * teal) but is purpose-built for the hero: seats land in a single orchestrated, motion-safe
 * sweep. Under `prefers-reduced-motion` the final, filled state is shown immediately with
 * no movement. It is decorative, so the grid itself is hidden from screen readers and the
 * live count is announced in text beside it.
 *
 * A small shift toggle (Morning / Afternoon / Evening) swaps which seats are taken in a
 * fixed illustrative pattern, so the same seats read free in one shift and taken in another.
 * Switching shifts never re-runs the fill-in sweep; only the seat states cross-fade.
 */

type HeroState = 'free' | 'occupied' | 'expiring'
type HeroShift = 'morning' | 'afternoon' | 'evening'

const seatStyles: Record<HeroState, string> = {
  free: 'border-primary bg-primary-soft text-primary-ink',
  occupied: 'border-primary bg-primary text-white',
  expiring: 'border-primary bg-primary text-white ring-2 ring-warning ring-offset-2 ring-offset-canvas',
}

/**
 * Fixed, hand-tuned layouts so the hero reads the same every load, and the same seat
 * numbers change state across shifts: Morning nearly full, Afternoon about half, Evening
 * mostly free. Same 40 seats, same positions, different occupancy per shift.
 */
const LAYOUTS: Record<HeroShift, HeroState[]> = {
  morning: [
    'occupied', 'occupied', 'free', 'occupied', 'occupied', 'occupied', 'free', 'occupied',
    'occupied', 'free', 'occupied', 'occupied', 'expiring', 'free', 'occupied', 'occupied',
    'occupied', 'occupied', 'free', 'occupied', 'occupied', 'free', 'occupied', 'occupied',
    'free', 'occupied', 'occupied', 'occupied', 'free', 'occupied', 'expiring', 'occupied',
    'occupied', 'free', 'occupied', 'occupied', 'occupied', 'free', 'occupied', 'occupied',
  ],
  afternoon: [
    'occupied', 'free', 'free', 'occupied', 'free', 'occupied', 'free', 'occupied',
    'free', 'free', 'occupied', 'occupied', 'free', 'free', 'occupied', 'free',
    'occupied', 'free', 'free', 'occupied', 'occupied', 'free', 'occupied', 'free',
    'free', 'occupied', 'free', 'occupied', 'free', 'occupied', 'expiring', 'free',
    'occupied', 'free', 'occupied', 'free', 'occupied', 'free', 'free', 'occupied',
  ],
  evening: [
    'free', 'free', 'free', 'occupied', 'free', 'free', 'free', 'occupied',
    'free', 'free', 'free', 'occupied', 'free', 'free', 'free', 'free',
    'occupied', 'free', 'free', 'free', 'free', 'free', 'occupied', 'free',
    'free', 'free', 'free', 'occupied', 'free', 'free', 'free', 'free',
    'occupied', 'free', 'free', 'free', 'occupied', 'free', 'free', 'free',
  ],
}

const SHIFTS: { key: HeroShift; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
]

export function HeroSeatGrid({ className }: { className?: string }) {
  const [shift, setShift] = useState<HeroShift>('morning')
  const layout = LAYOUTS[shift]

  const free = useMemo(() => layout.filter((s) => s === 'free').length, [layout])
  const occupied = layout.length - free

  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // When motion is allowed, seats start hidden and are revealed in one sweep on first load.
  // Otherwise they are all visible from the first paint. Switching shifts never re-runs this.
  const [revealed, setRevealed] = useState(reduceMotion)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (reduceMotion) return
    // One frame later so the transition has a start state to animate from.
    timer.current = window.requestAnimationFrame(() => setRevealed(true))
    return () => {
      if (timer.current) cancelAnimationFrame(timer.current)
    }
  }, [reduceMotion])

  return (
    <figure className={cx('m-0', className)}>
      <ul
        aria-hidden
        className="grid grid-cols-8 justify-items-center gap-1.5 sm:gap-2"
      >
        {layout.map((state, i) => (
          <li key={i} className="contents">
            <span
              className={cx(
                'relative flex aspect-square w-full max-w-11 items-center justify-center',
                'rounded-[0.7rem_0.7rem_0.35rem_0.35rem] border-2 text-xs font-semibold tabular-nums',
                seatStyles[state],
                // Colour change on shift switch cross-fades; the fill-in sweep still only runs once.
                'motion-safe:transition-[opacity,transform,background-color,border-color] motion-safe:duration-500 motion-safe:ease-out',
                revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
              )}
              style={
                reduceMotion || revealed
                  ? undefined
                  : { transitionDelay: `${Math.min(i * 22, 900)}ms` }
              }
            >
              {i + 1}
              {state === 'expiring' && (
                <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-warning text-white">
                  <Clock className="size-2.5" />
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <figcaption
        aria-live="polite"
        className="mt-4 text-center text-sm font-medium text-ink-muted tabular-nums"
      >
        <span className="text-primary-ink">{free} free</span> · {occupied} taken this shift
      </figcaption>

      <div
        role="group"
        aria-label="See seats free by shift"
        className="mt-4 flex flex-wrap justify-center gap-2"
      >
        {SHIFTS.map((s) => {
          const selected = s.key === shift
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setShift(s.key)}
              className={cx(
                'min-h-11 min-w-0 flex-1 cursor-pointer rounded-control border px-2 text-sm font-medium transition-colors sm:flex-none sm:px-4',
                selected
                  ? 'border-primary bg-primary-soft text-primary-ink'
                  : 'border-border-strong bg-surface text-ink hover:bg-canvas',
              )}
            >
              {s.label}
            </button>
          )
        })}
      </div>
    </figure>
  )
}
