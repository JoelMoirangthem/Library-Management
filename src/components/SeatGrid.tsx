import { Clock, TriangleAlert } from 'lucide-react'
import type { SeatCell, SeatCellState } from '@/domain/seatCells'
import { cx } from '@/lib/cx'

/**
 * Seat grid: the signature component.
 * Every state has a second cue besides colour (shape, ring, icon dot, hatching), so it
 * reads in sunlight and for colour-blind users. Each seat is a real <button> with a full
 * spoken label.
 */
type Props = {
  seats: SeatCell[]
  selectedId?: string | null
  /** Omit for a read-only grid. Disabled seats are never selectable. */
  onSelect?: (seatId: string) => void
  /** Hide the legend/summary when the page already explains the states. */
  showLegend?: boolean
  className?: string
}

const base =
  'relative flex size-11 items-center justify-center rounded-[0.7rem_0.7rem_0.35rem_0.35rem] border-2 text-sm font-semibold tabular-nums transition-[transform,box-shadow] duration-150'

const styles: Record<SeatCellState, string> = {
  free: 'border-primary bg-primary-soft text-primary-ink',
  occupied: 'border-primary bg-primary text-white',
  expiring: 'border-primary bg-primary text-white ring-2 ring-warning ring-offset-2 ring-offset-surface',
  overdue: 'border-danger bg-surface text-danger-ink',
  disabled:
    'cursor-not-allowed border-dashed border-border-strong text-ink-muted ' +
    'bg-[repeating-linear-gradient(135deg,var(--color-border)_0_4px,transparent_4px_8px)]',
}

export function SeatSwatch({ state }: { state: SeatCellState | 'selected' }) {
  if (state === 'selected') {
    return <span aria-hidden className="inline-block size-5 rounded-[0.4rem_0.4rem_0.2rem_0.2rem] border-2 border-primary bg-primary-soft ring-2 ring-ink ring-offset-1" />
  }
  return (
    <span
      aria-hidden
      className={cx(
        'inline-block size-5 rounded-[0.4rem_0.4rem_0.2rem_0.2rem] border-2',
        styles[state].replace('cursor-not-allowed', ''),
        state === 'expiring' && 'ring-1 ring-offset-1',
      )}
    />
  )
}

export function SeatLegend({ className }: { className?: string }) {
  const items: [SeatCellState | 'selected', string][] = [
    ['free', 'Free'],
    ['occupied', 'Occupied'],
    ['expiring', 'Expires in 7 days'],
    ['overdue', 'Overdue'],
    ['disabled', 'Not in use'],
  ]
  return (
    <ul className={cx('flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-muted', className)}>
      {items.map(([state, label]) => (
        <li key={state} className="flex items-center gap-2">
          <SeatSwatch state={state} />
          {label}
        </li>
      ))}
    </ul>
  )
}

export function SeatGrid({ seats, selectedId, onSelect, showLegend = true, className }: Props) {
  const free = seats.filter((s) => s.state === 'free').length
  const taken = seats.filter((s) => s.state === 'occupied' || s.state === 'expiring' || s.state === 'overdue').length

  return (
    <div className={className}>
      {showLegend && (
        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium tabular-nums" aria-live="polite">
            {free} free · {taken} occupied
          </p>
          <SeatLegend />
        </div>
      )}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] justify-items-center gap-x-2 gap-y-3">
        {seats.map((s) => {
          const selected = s.id === selectedId
          const interactive = !!onSelect && s.state !== 'disabled'
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-label={s.label}
                aria-pressed={onSelect ? selected : undefined}
                aria-disabled={s.state === 'disabled' || undefined}
                disabled={!interactive && !!onSelect}
                onClick={() => interactive && onSelect?.(s.id)}
                className={cx(
                  base,
                  styles[s.state],
                  interactive ? 'cursor-pointer motion-safe:active:scale-95' : !onSelect && 'cursor-default',
                  selected && 'ring-4 ring-ink ring-offset-2 ring-offset-surface',
                )}
              >
                {s.number}
                {s.state === 'expiring' && (
                  <span aria-hidden className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-warning text-white">
                    <Clock className="size-2.5" />
                  </span>
                )}
                {s.state === 'overdue' && (
                  <span aria-hidden className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-danger text-white">
                    <TriangleAlert className="size-2.5" />
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Decorative strip for library cards and the landing hero: one tiny square per seat
 * (up to `max`), filled = taken. Hidden from screen readers; put the real numbers in text beside it.
 */
export function SeatStrip({
  total,
  free,
  max = 30,
  className,
}: {
  total: number
  free: number
  max?: number
  className?: string
}) {
  const shown = Math.min(total, max)
  const freeShown = total === 0 ? 0 : Math.round((free / total) * shown)
  return (
    <div aria-hidden className={cx('flex flex-wrap gap-1', className)}>
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className={cx(
            'size-2.5 rounded-[3px] border',
            i < shown - freeShown ? 'border-primary bg-primary' : 'border-primary bg-primary-soft',
          )}
        />
      ))}
    </div>
  )
}
