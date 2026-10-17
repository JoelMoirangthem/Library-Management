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
 */

type HeroState = 'free' | 'occupied' | 'expiring'

const seatStyles: Record<HeroState, string> = {
  free: 'border-primary bg-primary-soft text-primary-ink',
  occupied: 'border-primary bg-primary text-white',
  expiring: 'border-primary bg-primary text-white ring-2 ring-warning ring-offset-2 ring-offset-canvas',
}

/** A fixed, hand-tuned layout so the hero reads the same every load: calm, mostly taken, a few free. */
const LAYOUT: HeroState[] = [
  'occupied', 'occupied', 'free', 'occupied', 'occupied', 'occupied', 'free', 'occupied',
  'occupied', 'free', 'occupied', 'occupied', 'expiring', 'free', 'occupied', 'occupied',
  'occupied', 'occupied', 'free', 'occupied', 'occupied', 'free', 'occupied', 'occupied',
  'free', 'occupied', 'occupied', 'occupied', 'free', 'occupied', 'expiring', 'occupied',
  'occupied', 'free', 'occupied', 'occupied', 'occupied', 'free', 'occupied', 'occupied',
]

export function HeroSeatGrid({ className }: { className?: string }) {
  const free = useMemo(() => LAYOUT.filter((s) => s === 'free').length, [])
  const occupied = LAYOUT.length - free

  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // When motion is allowed, seats start hidden and are revealed one sweep. Otherwise they
  // are all visible from the first paint.
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
        {LAYOUT.map((state, i) => (
          <li key={i} className="contents">
            <span
              className={cx(
                'relative flex aspect-square w-full max-w-11 items-center justify-center',
                'rounded-[0.7rem_0.7rem_0.35rem_0.35rem] border-2 text-xs font-semibold tabular-nums',
                seatStyles[state],
                'motion-safe:transition-[opacity,transform] motion-safe:duration-500 motion-safe:ease-out',
                revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
              )}
              style={
                reduceMotion
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
        <span className="text-primary-ink">{free} free</span> · {occupied} occupied right now
      </figcaption>
    </figure>
  )
}
