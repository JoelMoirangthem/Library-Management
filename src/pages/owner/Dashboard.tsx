import { Link } from 'react-router-dom'
import {
  Armchair,
  CalendarClock,
  CircleCheck,
  Hourglass,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageHeader, StatCard } from '@/components/PageParts'
import { SeatStrip } from '@/components/SeatGrid'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { SetupState } from '@/components/states/SetupState'
import { ExpiringList, RecentJoins, type DashMember } from '@/components/owner/DashboardLists'
import { todayIST } from '@/domain/dates'
import { memberDaysLeft, memberPhase } from '@/domain/members'
import { buildSeatCells, seatCounts } from '@/domain/seatCells'
import type { Member, Seat } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { services } from '@/lib/container'
import { useNow } from '@/lib/devState'

function dayWord(n: number) {
  return `${n} day${n === 1 ? '' : 's'}`
}

function toDash(m: Member, seatNumber: number | null, today: string): DashMember {
  return {
    id: m.id,
    name: m.name,
    phone: m.phone,
    seatNumber,
    daysLeft: memberDaysLeft(m, today),
    startDate: m.startDate,
  }
}

export default function Dashboard() {
  const now = useNow()
  const today = todayIST(now)
  const { library, state, daysLeft, loading, error, reload } = useOwnerLibrary()

  const seats = useAsync(
    () => (library ? services.listSeats(library.id) : Promise.resolve([] as Seat[])),
    [library?.id],
  )
  const members = useAsync(
    () => (library ? services.listMembers(library.id) : Promise.resolve([] as Member[])),
    [library?.id],
  )
  const requests = useAsync(
    () => (library ? services.listLibrarySeatRequests(library.id) : Promise.resolve([])),
    [library?.id],
  )

  if (loading) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <LoadingState layout="cards" count={4} label="Loading your dashboard" />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <ErrorState onRetry={reload} />
      </>
    )
  }

  // No library yet.
  if (state === 'none' || !library) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <SetupState
          action={
            <Link to="/owner/library" className={buttonStyles('primary')}>
              List your library
            </Link>
          }
        />
      </>
    )
  }

  // Pending / rejected: a status card instead of numbers.
  if (state === 'pending') {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
          <span
            aria-hidden
            className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-warning-soft text-warning-ink"
          >
            <Hourglass className="size-7" />
          </span>
          <h2 className="text-xl font-semibold">In review, usually within 24 hours</h2>
          <p className="mx-auto mt-2 max-w-prose text-ink-muted">
            We check every listing by hand. Once approved, your 14-day free trial starts and your
            seats, students and fees tools unlock here.
          </p>
          <div className="mt-6 flex justify-center">
            <Link to="/owner/library" className={buttonStyles('secondary')}>
              View library details
            </Link>
          </div>
        </Card>
      </>
    )
  }

  if (state === 'rejected') {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card className="mx-auto max-w-xl p-6 sm:p-8">
          <span
            aria-hidden
            className="mb-5 flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger-ink"
          >
            <ShieldAlert className="size-7" />
          </span>
          <h2 className="text-xl font-semibold">Your library needs changes</h2>
          {library.rejectionReason && (
            <blockquote className="mt-3 border-l-2 border-danger bg-danger-soft/40 px-4 py-3 text-ink">
              {library.rejectionReason}
            </blockquote>
          )}
          <p className="mt-3 max-w-prose text-ink-muted">
            Fix the points above and resubmit. We'll review it again, usually within 24 hours.
          </p>
          <div className="mt-6">
            <Link to="/owner/library" className={buttonStyles('primary')}>
              Fix and resubmit
            </Link>
          </div>
        </Card>
      </>
    )
  }

  // Approved states (trial / paid / expired): show the real numbers.
  const dataLoading = seats.loading || members.loading
  const dataError = seats.error ?? members.error

  const planCard: ReactNode = (
    <Card className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={`flex size-10 items-center justify-center rounded-full [&>svg]:size-5 ${
            state === 'expired' ? 'bg-danger-soft text-danger-ink' : 'bg-primary-soft text-primary-ink'
          }`}
        >
          {state === 'expired' ? <CalendarClock /> : <CircleCheck />}
        </span>
        <div>
          <p className="font-medium">
            {state === 'trial' && 'Free trial'}
            {state === 'paid' && 'Plan active'}
            {state === 'expired' && 'Plan expired'}
          </p>
          <p className="text-sm text-ink-muted tabular-nums">
            {state === 'expired' ? 'Renew to go live again' : `${dayWord(daysLeft)} left`}
          </p>
        </div>
      </div>
      <Link to="/owner/plan" className={buttonStyles(state === 'expired' ? 'accent' : 'ghost')}>
        {state === 'expired' ? 'Renew plan' : 'View plan'}
      </Link>
    </Card>
  )

  if (dataLoading) {
    return (
      <>
        <PageHeader title="Dashboard" />
        {planCard}
        <div className="mt-6">
          <LoadingState layout="cards" count={4} label="Loading your numbers" />
        </div>
      </>
    )
  }

  if (dataError) {
    return (
      <>
        <PageHeader title="Dashboard" />
        {planCard}
        <div className="mt-6">
          <ErrorState onRetry={() => { seats.reload(); members.reload() }} />
        </div>
      </>
    )
  }

  const allSeats = seats.data ?? []
  const allMembers = members.data ?? []
  const activeMembers = allMembers.filter((m) => m.status === 'active')

  const cells = buildSeatCells(allSeats, allMembers, today)
  const counts = seatCounts(cells)

  const seatNumberById = new Map(allSeats.map((s) => [s.id, s.seatNumber]))
  const seatOf = (m: Member) => (m.seatId ? seatNumberById.get(m.seatId) ?? null : null)

  // Expiring in the next 7 days: active members with phase 'expiring', soonest first.
  const expiring = activeMembers
    .filter((m) => memberPhase(m, today) === 'expiring')
    .map((m) => toDash(m, seatOf(m), today))
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // Overdue: expired but still seated.
  const overdue = activeMembers
    .filter((m) => m.seatId && memberPhase(m, today) === 'expired')
    .map((m) => toDash(m, seatOf(m), today))
    .sort((a, b) => a.daysLeft - b.daysLeft)

  // Recent joins: last 5 by startDate.
  const recent = activeMembers
    .slice()
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 5)
    .map((m) => toDash(m, seatOf(m), today))

  const pendingRequests = (requests.data ?? []).filter((r) => r.status === 'pending')

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Here's how ${library.name} is doing today.`}
      />

      {planCard}

      {pendingRequests.length > 0 && (
        <Card className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-accent/30 bg-accent-soft p-4 text-accent-ink">
          <span aria-hidden className="[&>svg]:size-5">
            <Users />
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium tabular-nums">
            {pendingRequests.length} student{pendingRequests.length === 1 ? ' is' : 's are'} waiting for a seat.
          </p>
          <Link to="/owner/requests" className={buttonStyles('accent')}>
            Review requests
          </Link>
        </Card>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total seats" value={counts.total} icon={<Armchair />} />
        <StatCard label="Occupied" value={counts.occupied} icon={<UserCheck />} tone="primary" />
        <StatCard label="Available" value={counts.free} icon={<Armchair />} />
        <StatCard label="Active students" value={activeMembers.length} icon={<Users />} tone="primary" />
      </div>

      {counts.total > 0 && (
        <Card className="mt-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium tabular-nums">
              {counts.free} free · {counts.occupied} occupied
            </p>
            <Link to="/owner/seats" className="text-sm font-medium text-primary hover:underline">
              Open seat grid
            </Link>
          </div>
          <SeatStrip total={counts.total} free={counts.free} className="mt-3" />
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ExpiringList
          title="Expiring in the next 7 days"
          description="Students whose fees are due soon. Call to remind them."
          members={expiring}
          tone="warning"
          footer={
            <Link to="/owner/students" className="text-sm font-medium text-primary hover:underline">
              View all students
            </Link>
          }
        />
        <RecentJoins members={recent} />
      </div>

      {overdue.length > 0 && (
        <div className="mt-6">
          <ExpiringList
            title="Overdue"
            description="Seated students whose fees have lapsed. Renew or free their seat."
            members={overdue}
            tone="danger"
            footer={
              <Link to="/owner/students" className="text-sm font-medium text-primary hover:underline">
                Manage students
              </Link>
            }
          />
        </div>
      )}
    </>
  )
}
