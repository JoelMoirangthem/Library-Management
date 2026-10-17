import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { Card } from '@/components/Card'
import { buttonStyles } from '@/components/Button'
import { ShiftBadge } from '@/components/ShiftTabs'
import { formatDate } from '@/domain/dates'
import type { Shift } from '@/domain/types'

export type DashMember = {
  id: string
  name: string
  phone: string
  seatNumber: number | null
  daysLeft: number
  /** For recent joins. */
  startDate?: string
  /** The shift this membership is for; shown as a badge so a two-shift student reads once per shift. */
  shift?: Pick<Shift, 'name'> & { isActive?: boolean }
}

function seatText(n: number | null) {
  return n == null ? 'No seat' : `Seat ${n}`
}

function daysText(days: number) {
  if (days < 0) return `overdue by ${-days} day${days === -1 ? '' : 's'}`
  if (days === 0) return 'expires today'
  return `${days} day${days === 1 ? '' : 's'} left`
}

function CallLink({ phone, name }: { phone: string; name: string }) {
  return (
    <a
      href={`tel:${phone}`}
      aria-label={`Call ${name}`}
      className={buttonStyles('secondary', 'size-11 shrink-0 px-0')}
    >
      <Phone aria-hidden className="size-4" />
    </a>
  )
}

/** Expiring / overdue rows: name, seat, days-left phrase, Call button. */
export function ExpiringList({
  title,
  description,
  members,
  tone = 'warning',
  footer,
}: {
  title: string
  description?: string
  members: DashMember[]
  tone?: 'warning' | 'danger'
  footer?: React.ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border p-4 sm:px-5">
        <h2 className="text-lg font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {members.length === 0 ? (
        <p className="p-4 text-sm text-ink-muted sm:px-5">Nothing here right now.</p>
      ) : (
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 p-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{m.name}</p>
                  {m.shift && <ShiftBadge shift={m.shift} />}
                </div>
                <p className="text-sm text-ink-muted tabular-nums">
                  {seatText(m.seatNumber)} ·{' '}
                  <span className={tone === 'danger' ? 'text-danger' : 'text-warning-ink'}>
                    {daysText(m.daysLeft)}
                  </span>
                </p>
              </div>
              <CallLink phone={m.phone} name={m.name} />
            </li>
          ))}
        </ul>
      )}
      {footer && <div className="border-t border-border p-4 sm:px-5">{footer}</div>}
    </Card>
  )
}

/** Recent joins: name, seat, start date. */
export function RecentJoins({ members }: { members: DashMember[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border p-4 sm:px-5">
        <h2 className="text-lg font-semibold">Recent joins</h2>
      </div>
      {members.length === 0 ? (
        <p className="p-4 text-sm text-ink-muted sm:px-5">No students yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 p-4 sm:px-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-medium">{m.name}</p>
                  {m.shift && <ShiftBadge shift={m.shift} />}
                </div>
                <p className="text-sm text-ink-muted tabular-nums">{seatText(m.seatNumber)}</p>
              </div>
              {m.startDate && (
                <p className="shrink-0 text-sm text-ink-muted tabular-nums">{formatDate(m.startDate)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-border p-4 sm:px-5">
        <Link to="/owner/students" className="text-sm font-medium text-primary hover:underline">
          View all students
        </Link>
      </div>
    </Card>
  )
}
