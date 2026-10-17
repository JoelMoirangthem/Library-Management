import { Link } from 'react-router-dom'
import { MessageCircle, Phone, RefreshCw } from 'lucide-react'
import { Button, buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { ShiftBadge } from '@/components/ShiftTabs'
import { formatPhone, whatsappLink } from '@/domain/constants'
import type { Member, Shift } from '@/domain/types'
import { reminderMessage } from '@/components/owner/home/reminder'

/** One student needing attention, with everything a row needs to render and act. */
export type AttentionRow = {
  member: Member
  seatNumber: number | null
  daysLeft: number
  shift?: Pick<Shift, 'name'> & { isActive?: boolean }
}

function daysText(days: number) {
  if (days < 0) return `overdue by ${-days} day${days === -1 ? '' : 's'}`
  if (days === 0) return 'expires today'
  return `${days} day${days === 1 ? '' : 's'} left`
}

function seatText(n: number | null) {
  return n == null ? 'No seat' : `Seat ${n}`
}

/**
 * A titled card inside "Needs your attention": up to 5 rows, each with three 44px
 * one-tap actions (Renew in place, WhatsApp reminder, Call) and a "Show all N" link
 * pinned to the bottom. On phones the actions stack below the name; from sm up they
 * sit inline on the right. Cards are equal-height so two sit side by side cleanly.
 */
export function AttentionBlock({
  title,
  tone,
  rows,
  total,
  filterHref,
  libraryName,
  onRenew,
}: {
  title: string
  tone: 'danger' | 'warning'
  rows: AttentionRow[]
  total: number
  filterHref: string
  libraryName: string
  onRenew: (member: Member) => void
}) {
  if (rows.length === 0) return null
  const toneText = tone === 'danger' ? 'text-danger' : 'text-warning-ink'
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border p-4 sm:px-5">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          {title}
          <span className="tabular-nums text-ink-muted">{total}</span>
        </h3>
      </div>
      <ul className="flex-1 divide-y divide-border">
        {rows.map(({ member: m, seatNumber, daysLeft, shift }) => (
          <li
            key={`${m.id}-${m.shiftId}`}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          >
            <div className="min-w-0 sm:flex-1">
              <p className="truncate font-medium">{m.name}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted tabular-nums">
                {shift && <ShiftBadge shift={shift} />}
                <span>
                  {seatText(seatNumber)} ·{' '}
                  <span className={toneText}>{daysText(daysLeft)}</span>
                </span>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="primary" className="px-3" onClick={() => onRenew(m)}>
                <RefreshCw aria-hidden className="size-4" /> Renew
              </Button>
              <a
                href={whatsappLink(
                  m.phone,
                  reminderMessage({
                    name: m.name,
                    shift: shift?.name ?? 'study',
                    library: libraryName,
                    expiry: m.expiryDate,
                  }),
                )}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Send ${m.name} a WhatsApp reminder`}
                className={buttonStyles('secondary', 'px-3')}
              >
                <MessageCircle aria-hidden className="size-4" /> Remind
              </a>
              <a
                href={`tel:${m.phone}`}
                aria-label={`Call ${m.name} on ${formatPhone(m.phone)}`}
                className={buttonStyles('secondary', 'size-11 px-0 shrink-0')}
              >
                <Phone aria-hidden className="size-4" />
              </a>
            </div>
          </li>
        ))}
      </ul>
      {/* Always present, so both columns end on the same line. */}
      <div className="mt-auto border-t border-border p-4 sm:px-5">
        <Link
          to={filterHref}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
        >
          {total > rows.length ? `Show all ${total}` : 'View in Students'}
        </Link>
      </div>
    </Card>
  )
}

/**
 * The whole "Needs your attention" area: a pending-requests call-out strip first (the
 * orange accent is allowed only here), then Overdue and Expiring as two equal-height
 * cards side by side on lg+, stacked on phones. Shows a calm "all caught up" state.
 */
export function NeedsAttention({
  pendingCount,
  overdue,
  overdueTotal,
  expiring,
  expiringTotal,
  libraryName,
  onRenew,
}: {
  pendingCount: number
  overdue: AttentionRow[]
  overdueTotal: number
  expiring: AttentionRow[]
  expiringTotal: number
  libraryName: string
  onRenew: (member: Member) => void
}) {
  const nothing = pendingCount === 0 && overdueTotal === 0 && expiringTotal === 0

  if (nothing) {
    return (
      <Card className="p-4 sm:p-5">
        <h2 className="text-lg font-semibold">Needs your attention</h2>
        <div className="mt-3 flex items-center gap-3 rounded-card bg-success-soft p-4 text-success-ink">
          <span aria-hidden className="[&>svg]:size-5">
            <RefreshCw className="rotate-90" />
          </span>
          <p className="text-sm font-medium">All caught up. No renewals or requests waiting.</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-accent/30 bg-accent-soft p-4 text-accent-ink sm:p-5">
          <p className="min-w-0 flex-1 text-sm font-medium tabular-nums">
            {pendingCount} seat request{pendingCount === 1 ? '' : 's'} waiting.
          </p>
          <Link to="/owner/requests" className={buttonStyles('accent')}>
            Review requests
          </Link>
        </div>
      )}

      {(overdueTotal > 0 || expiringTotal > 0) && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Needs your attention</h2>
          <div className="grid items-stretch gap-4 lg:grid-cols-2">
            <AttentionBlock
              title="Overdue"
              tone="danger"
              rows={overdue}
              total={overdueTotal}
              filterHref="/owner/students?filter=overdue"
              libraryName={libraryName}
              onRenew={onRenew}
            />
            <AttentionBlock
              title="Expiring in 7 days"
              tone="warning"
              rows={expiring}
              total={expiringTotal}
              filterHref="/owner/students?filter=expiring"
              libraryName={libraryName}
              onRenew={onRenew}
            />
          </div>
        </div>
      )}
    </div>
  )
}
