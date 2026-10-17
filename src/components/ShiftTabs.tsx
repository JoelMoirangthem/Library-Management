import type { ReactNode } from 'react'
import { Clock } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { formatShiftRange } from '@/domain/shifts'
import type { Shift } from '@/domain/types'
import { cx } from '@/lib/cx'

type ShiftLike = Pick<Shift, 'id' | 'name' | 'startTime' | 'endTime'> & { isActive?: boolean }

/**
 * Shift picker used on the owner dashboard, seats and students pages.
 * Each option shows the name and the time range; `detail` adds a line such as "12 free".
 * Switched-off shifts stay selectable (their students are still tagged to them) and say "Off".
 */
export function ShiftTabs({
  shifts,
  value,
  onChange,
  detail,
  label = 'Shift',
  className,
}: {
  shifts: ShiftLike[]
  value: string
  onChange: (shiftId: string) => void
  detail?: (shift: ShiftLike) => ReactNode
  label?: string
  className?: string
}) {
  return (
    <div role="group" aria-label={label} className={cx('flex flex-wrap gap-2', className)}>
      {shifts.map((s) => {
        const selected = s.id === value
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(s.id)}
            className={cx(
              'flex min-h-14 cursor-pointer flex-col items-start rounded-control border px-4 py-2 text-left transition-colors',
              selected
                ? 'border-primary bg-primary-soft text-primary-ink'
                : 'border-border-strong bg-surface text-ink hover:bg-canvas',
            )}
          >
            <span className="flex items-center gap-2 font-medium">
              {s.name}
              {s.isActive === false && <Badge tone="neutral">Off</Badge>}
            </span>
            <span className="flex items-center gap-1 text-xs tabular-nums text-ink-muted">
              <Clock aria-hidden className="size-3" />
              {formatShiftRange(s)}
            </span>
            {detail && <span className="mt-0.5 text-sm font-medium tabular-nums">{detail(s)}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Small pill showing a shift name, e.g. in table rows. */
export function ShiftBadge({ shift }: { shift: Pick<Shift, 'name'> & { isActive?: boolean } | null | undefined }) {
  if (!shift) return null
  return (
    <Badge tone={shift.isActive === false ? 'neutral' : 'primary'}>
      {shift.name}
      {shift.isActive === false ? ' (off)' : ''}
    </Badge>
  )
}
