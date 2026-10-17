import { Link } from 'react-router-dom'
import { Clock, MapPin, MessageCircle, Phone } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { buttonStyles } from '@/components/Button'
import { CardGrid, GridCard, GridItem } from '@/components/CardGrid'
import { PageHeader } from '@/components/PageParts'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { daysBetween, formatDate, todayIST } from '@/domain/dates'
import { memberDaysLeft, memberPhase } from '@/domain/members'
import { FEE_MODES, whatsappLink } from '@/domain/constants'
import { formatRupees } from '@/domain/money'
import { formatShiftRange } from '@/domain/shifts'
import type { FeeMode, MyMembership as Membership } from '@/domain/types'
import { services } from '@/lib/container'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { useNow } from '@/lib/devState'

const feeModeLabel = (mode: FeeMode) => FEE_MODES.find((m) => m.value === mode)?.label ?? mode

/** Plain words for the days-left line. */
function daysLeftText(daysLeft: number): string {
  if (daysLeft < 0)
    return `Overdue by ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'}`
  if (daysLeft === 0) return 'Expires today'
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
}

function phaseBadge(phase: ReturnType<typeof memberPhase>): { tone: BadgeTone; label: string } {
  if (phase === 'expired') return { tone: 'danger', label: 'Expired' }
  if (phase === 'expiring') return { tone: 'warning', label: 'Expiring soon' }
  return { tone: 'success', label: 'Active' }
}

/** Fee history, tucked behind a disclosure so the ticket stays clean. */
function Payments({ m }: { m: Membership }) {
  const payments = [...m.payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn))
  return (
    <details className="group rounded-card border border-border">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-4 text-sm font-semibold">
        Payments
        <span className="text-ink-muted tabular-nums">
          {payments.length} {payments.length === 1 ? 'entry' : 'entries'}
        </span>
      </summary>
      <div className="border-t border-border px-4 py-3">
        {payments.length === 0 ? (
          <p className="text-sm text-ink-muted">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className={p.isVoid ? 'text-ink-muted line-through' : 'font-medium tabular-nums'}>
                    {formatRupees(p.amountPaise)}
                  </p>
                  <p className="text-ink-muted tabular-nums">
                    {formatDate(p.paidOn)} · {feeModeLabel(p.mode)}
                  </p>
                </div>
                {p.isVoid && <Badge tone="neutral">Voided</Badge>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

function MembershipCard({
  m,
  today,
  studentName,
}: {
  m: Membership
  today: string
  studentName: string
}) {
  // A membership whose shift we can't resolve shows nothing.
  if (!m.shift) return null

  const phase = memberPhase(m.member, today)
  const daysLeft = memberDaysLeft(m.member, today)
  const badge = phaseBadge(phase)
  const showReminder = phase === 'expiring' || phase === 'expired'

  // Progress across the paid period. Clamp so overdue reads as full and future starts read as empty.
  const span = Math.max(1, daysBetween(m.member.startDate, m.member.expiryDate))
  const elapsed = daysBetween(m.member.startDate, today)
  const percent = Math.min(100, Math.max(0, Math.round((elapsed / span) * 100)))

  const libPhone = m.library?.phone
  const libName = m.library?.name ?? 'your library'
  const waMessage = `Hi, I'd like to renew my ${m.shift.name} seat. — ${studentName}`

  return (
    <GridCard className="overflow-hidden">
      {/* Ticket head: fixed height so every ticket's header aligns. Seat number is the one bold beat. */}
      <div className="flex min-h-[7rem] items-stretch gap-4 border-b border-dashed border-border bg-primary-soft p-5">
        <div className="flex flex-col items-center justify-center">
          <span className="text-xs font-medium text-primary-ink">Seat</span>
          <span className="text-5xl font-semibold leading-none tabular-nums text-primary-ink">
            {m.seatNumber ?? '—'}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge tone="primary">{m.shift.name}</Badge>
              <span className="flex items-center gap-1 text-sm tabular-nums text-ink-muted">
                <Clock aria-hidden className="size-3.5" />
                {formatShiftRange(m.shift)}
              </span>
            </p>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </div>
          {m.library ? (
            <p className="mt-2 flex items-center gap-1.5 break-words text-sm text-ink-muted">
              <MapPin aria-hidden className="size-4 shrink-0" />
              {m.library.areaName}, {m.library.cityName}
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">This library is not currently listed.</p>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
            <span className="font-medium tabular-nums">{daysLeftText(daysLeft)}</span>
            <span className="text-ink-muted tabular-nums">Ends {formatDate(m.member.expiryDate)}</span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-valuetext={daysLeftText(daysLeft)}
            className="h-2 overflow-hidden rounded-full bg-border"
          >
            <div
              className={phase === 'expired' ? 'h-full bg-danger' : 'h-full bg-primary'}
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-xs text-ink-muted tabular-nums">
            <span>Started {formatDate(m.member.startDate)}</span>
            <span>{formatDate(m.member.expiryDate)}</span>
          </div>
        </div>

        {/* Reminder region: reserves the same height whether or not a reminder is shown. */}
        {showReminder && libPhone ? (
          <div className="space-y-3 rounded-card bg-warning-soft px-4 py-4 text-warning-ink">
            <p className="text-sm font-medium">
              {phase === 'expired'
                ? `Your seat has expired. Renew with ${libName} to keep it.`
                : `Your seat expires soon. Renew with ${libName} to keep it.`}
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href={whatsappLink(libPhone, waMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles('primary')}
              >
                <MessageCircle aria-hidden className="size-4" />
                Message on WhatsApp
              </a>
              <a href={`tel:${libPhone}`} className={buttonStyles('secondary')}>
                <Phone aria-hidden className="size-4" />
                Call
              </a>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">Your seat is active. No action needed right now.</p>
        )}

        {/* Payments disclosure pinned to the bottom so it lines up across tickets. */}
        <div className="mt-auto">
          <Payments m={m} />
        </div>
      </div>
    </GridCard>
  )
}

export default function MyMembership() {
  useTitle('My membership')
  const { user } = useAuth()
  const now = useNow()
  const today = todayIST(now)
  const memberships = useAsync(() => services.listMyMemberships(), [])
  const studentName = user?.name ?? 'A student'

  // Group memberships by library so two seats at one library sit together.
  const groups = (() => {
    const data = memberships.data ?? []
    const map = new Map<string, { name: string; items: Membership[] }>()
    for (const m of data) {
      const key = m.library?.id ?? m.member.libraryId
      const name = m.library?.name ?? 'Your library'
      const group = map.get(key) ?? { name, items: [] }
      group.items.push(m)
      map.set(key, group)
    }
    return [...map.values()]
  })()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader title="My membership" description="Your seat, dates and payments." />

      {memberships.loading ? (
        <LoadingState layout="cards" count={1} label="Loading your membership" />
      ) : memberships.error ? (
        <ErrorState onRetry={memberships.reload} retrying={memberships.refreshing} />
      ) : groups.length === 0 ? (
        <EmptyState
          title="You're not a member of a library yet"
          description="Request a seat at a library and it'll show up here once the owner approves."
          action={
            <Link to="/discover" className={buttonStyles('primary')}>
              Find a library
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group, i) => {
            const libId = group.items[0].library?.id
            const tickets = group.items.filter((m) => m.shift)
            return (
              <section key={libId ?? i} aria-label={group.name} className="space-y-4">
                <h2 className="text-lg font-semibold leading-tight">
                  {libId ? (
                    <Link
                      to={`/library/${libId}`}
                      className="inline-flex min-h-11 items-center break-words hover:underline"
                    >
                      {group.name}
                    </Link>
                  ) : (
                    group.name
                  )}
                </h2>
                <CardGrid count={tickets.length} max={2}>
                  {tickets.map((m) => (
                    <GridItem key={m.member.id}>
                      <MembershipCard m={m} today={today} studentName={studentName} />
                    </GridItem>
                  ))}
                </CardGrid>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
