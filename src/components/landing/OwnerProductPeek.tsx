import { Clock, TriangleAlert, UserRoundPlus } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Card } from '@/components/Card'
import { SeatStrip } from '@/components/SeatGrid'

/**
 * A static, non-interactive miniature of the owner "Today" screen, built from the real
 * components owners use (Card, Badge, SeatStrip). It shows illustrative data so owners can
 * see what they get at a glance, without wiring up any live data. Decorative and fully
 * hidden from assistive tech (`aria-hidden`); the surrounding copy carries the meaning.
 */
export function OwnerProductPeek() {
  return (
    <Card aria-hidden className="overflow-hidden bg-canvas p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Today</p>
          <p className="truncate text-sm font-semibold text-ink">Gyan Deep Library</p>
        </div>
        <Badge tone="primary">Morning</Badge>
      </div>

      <div className="mt-3 rounded-control border border-warning-soft bg-warning-soft/60 px-3 py-2">
        <p className="text-sm font-medium text-warning-ink">
          Needs your attention: 3 requests waiting, 2 overdue
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-control border border-border bg-surface px-2 py-2">
          <p className="text-lg font-semibold tabular-nums text-ink">39</p>
          <p className="text-xs text-ink-muted">Seats</p>
        </div>
        <div className="rounded-control border border-border bg-surface px-2 py-2">
          <p className="text-lg font-semibold tabular-nums text-success-ink">31</p>
          <p className="text-xs text-ink-muted">Occupied</p>
        </div>
        <div className="rounded-control border border-border bg-surface px-2 py-2">
          <p className="text-lg font-semibold tabular-nums text-primary-ink">8</p>
          <p className="text-xs text-ink-muted">Free</p>
        </div>
      </div>

      <div className="mt-4">
        <SeatStrip total={39} free={8} max={39} />
      </div>

      <ul className="mt-4 space-y-2">
        <li className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-ink">
            <UserRoundPlus className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">Riya Sharma asked for a seat</span>
          <Badge tone="primary">New</Badge>
        </li>
        <li className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning-ink">
            <Clock className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">Aman Verma expires in 3 days</span>
          <Badge tone="warning">Expiring</Badge>
        </li>
        <li className="flex items-center gap-2 rounded-control border border-border bg-surface px-3 py-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger-ink">
            <TriangleAlert className="size-4" />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-ink">Sana Khan is 5 days overdue</span>
          <Badge tone="danger">Overdue</Badge>
        </li>
      </ul>
    </Card>
  )
}
