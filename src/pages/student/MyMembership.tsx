import { Link } from 'react-router-dom'
import { CalendarClock, MapPin, Phone, TriangleAlert } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageHeader } from '@/components/PageParts'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { formatDate, todayIST } from '@/domain/dates'
import { memberDaysLeft, memberPhase } from '@/domain/members'
import { FEE_MODES } from '@/domain/constants'
import { formatRupees } from '@/domain/money'
import type { FeeMode, MyMembership as Membership } from '@/domain/types'
import { services } from '@/lib/container'
import { useAsync } from '@/hooks/useAsync'
import { useNow } from '@/lib/devState'

const feeModeLabel = (mode: FeeMode) => FEE_MODES.find((m) => m.value === mode)?.label ?? mode

/** Plain words for the days-left line. */
function daysLeftText(daysLeft: number): string {
  if (daysLeft < 0) return `Overdue by ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'day' : 'days'}`
  if (daysLeft === 0) return 'Expires today'
  return `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`
}

function phaseBadge(phase: ReturnType<typeof memberPhase>): { tone: BadgeTone; label: string } {
  if (phase === 'expired') return { tone: 'danger', label: 'Expired' }
  if (phase === 'expiring') return { tone: 'warning', label: 'Expiring soon' }
  return { tone: 'success', label: 'Active' }
}

function MembershipCard({ m, today }: { m: Membership; today: string }) {
  const phase = memberPhase(m.member, today)
  const daysLeft = memberDaysLeft(m.member, today)
  const badge = phaseBadge(phase)
  const libName = m.library?.name ?? 'Your library'
  const showReminder = phase === 'expiring' || phase === 'expired'
  const payments = [...m.payments].sort((a, b) => b.paidOn.localeCompare(a.paidOn))

  return (
    <Card className="overflow-hidden">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">
              {m.library ? (
                <Link to={`/library/${m.library.id}`} className="hover:underline">
                  {libName}
                </Link>
              ) : (
                libName
              )}
            </h2>
            {m.library ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-muted">
                <MapPin aria-hidden className="size-4 shrink-0" />
                {m.library.areaName}, {m.library.cityName}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-ink-muted">This library is not currently listed.</p>
            )}
          </div>
          <Badge tone={badge.tone}>{badge.label}</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-card bg-canvas p-4 text-center">
            <p className="text-sm text-ink-muted">Seat</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {m.seatNumber ?? '—'}
            </p>
          </div>
          <div className="rounded-card bg-canvas p-4">
            <p className="text-sm text-ink-muted">Started</p>
            <p className="mt-1 font-semibold tabular-nums">{formatDate(m.member.startDate)}</p>
          </div>
          <div className="rounded-card bg-canvas p-4">
            <p className="text-sm text-ink-muted">Expires</p>
            <p className="mt-1 font-semibold tabular-nums">{formatDate(m.member.expiryDate)}</p>
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-sm font-medium tabular-nums">
          <CalendarClock aria-hidden className="size-4 text-ink-muted" />
          {daysLeftText(daysLeft)}
        </p>

        {showReminder && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-card bg-warning-soft px-4 py-3 text-sm text-warning-ink"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <p>
              {phase === 'expired'
                ? `Your membership has ended. Ask ${libName} to renew.`
                : `Your membership ends in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}. Ask ${libName} to renew.`}
            </p>
          </div>
        )}

        {m.library && (
          <a href={`tel:${m.library.phone}`} className={buttonStyles('secondary')}>
            <Phone aria-hidden className="size-4" />
            Call library
          </a>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold">Fee history</h3>
          {payments.length === 0 ? (
            <p className="text-sm text-ink-muted">No payments recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border rounded-card border border-border">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
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
      </div>
    </Card>
  )
}

export default function MyMembership() {
  const now = useNow()
  const today = todayIST(now)
  const memberships = useAsync(() => services.listMyMemberships(), [])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PageHeader title="My membership" description="Your seat, dates and fee history." />

      {memberships.loading ? (
        <LoadingState layout="cards" count={1} label="Loading your membership" />
      ) : memberships.error ? (
        <ErrorState onRetry={memberships.reload} retrying={memberships.refreshing} />
      ) : !memberships.data || memberships.data.length === 0 ? (
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
        <div className="space-y-6">
          {memberships.data.map((m) => (
            <MembershipCard key={m.member.id} m={m} today={today} />
          ))}
        </div>
      )}
    </div>
  )
}
