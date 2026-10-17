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
 * A titled block inside "Needs your attention": up to 5 rows, each with three 44px
 * one-tap actions (Renew in place, WhatsApp reminder, Call) and a "Show all N" link.
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
    <div>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          {title}
          <span className="tabular-nums text-ink-muted">{total}</span>
        </h3>
      </div>
      <ul className="mt-2 divide-y divide-border rounded-card border border-border bg-surface">
        {rows.map(({ member: m, seatNumber, daysLeft, shift }) => (
          <li key={`${m.id}-${m.shiftId}`} className="p-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium">{m.name}</p>
                {shift && <ShiftBadge shift={shift} />}
              </div>
              <p className="mt-0.5 text-sm text-ink-muted tabular-nums">
                {seatText(seatNumber)} ·{' '}
                <span className={toneText}>{daysText(daysLeft)}</span>
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
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
      {total > rows.length && (
        <div className="mt-2">
          <Link
            to={filterHref}
            className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
          >
            Show all {total}
          </Link>
        </div>
      )}
    </div>
  )
}

/**
 * The whole "Needs your attention" card: pending requests banner first (orange accent is
 * allowed only here), then Overdue, then Expiring. Shows a calm "all caught up" state.
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

  return (
    <Card className="p-4 sm:p-5">
      <h2 className="text-lg font-semibold">Needs your attention</h2>

      {nothing ? (
        <div className="mt-3 flex items-center gap-3 rounded-card bg-success-soft p-4 text-success-ink">
          <span aria-hidden className="[&>svg]:size-5">
            <RefreshCw className="rotate-90" />
          </span>
          <p className="text-sm font-medium">All caught up. No renewals or requests waiting.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-5">
          {pendingCount > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-accent/30 bg-accent-soft p-4 text-accent-ink">
              <p className="min-w-0 flex-1 text-sm font-medium tabular-nums">
                {pendingCount} seat request{pendingCount === 1 ? '' : 's'} waiting.
              </p>
              <Link to="/owner/requests" className={buttonStyles('accent')}>
                Review requests
              </Link>
            </div>
          )}

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
      )}
    </Card>
  )
}
