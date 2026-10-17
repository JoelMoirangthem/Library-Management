import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Armchair,
  CalendarClock,
  Hourglass,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react'
import { buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageHeader, StatCard } from '@/components/PageParts'
import { SeatStrip } from '@/components/SeatGrid'
import { ShiftTabs } from '@/components/ShiftTabs'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { SetupState } from '@/components/states/SetupState'
import { RecentJoins, type DashMember } from '@/components/owner/DashboardLists'
import { NeedsAttention, type AttentionRow } from '@/components/owner/home/AttentionList'
import { RenewModal } from '@/components/owner/members'
import { formatDate, todayIST } from '@/domain/dates'
import { memberDaysLeft, memberPhase } from '@/domain/members'
import { formatRupees } from '@/domain/money'
import { buildSeatCells, seatCounts } from '@/domain/seatCells'
import { formatShiftRange, sortShifts } from '@/domain/shifts'
import type { Member, Seat, Shift } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { useTitle } from '@/hooks/useTitle'
import { services } from '@/lib/container'
import { useNow } from '@/lib/devState'

const ATTENTION_PER_BLOCK = 5

function toDash(m: Member, seatNumber: number | null, today: string, shift?: Shift): DashMember {
  return {
    id: m.id,
    name: m.name,
    phone: m.phone,
    seatNumber,
    daysLeft: memberDaysLeft(m, today),
    startDate: m.startDate,
    shift: shift ? { name: shift.name, isActive: shift.isActive } : undefined,
  }
}

export default function Dashboard() {
  useTitle('Today')
  const now = useNow()
  const today = todayIST(now)
  const { library, state, loading, error, reload } = useOwnerLibrary()

  const seats = useAsync(
    () => (library ? services.listSeats(library.id) : Promise.resolve([] as Seat[])),
    [library?.id],
  )
  const members = useAsync(
    () => (library ? services.listMembers(library.id) : Promise.resolve([] as Member[])),
    [library?.id],
  )
  const shiftsQ = useAsync(
    () => (library ? services.listShifts(library.id) : Promise.resolve([] as Shift[])),
    [library?.id],
  )
  const requests = useAsync(
    () => (library ? services.listLibrarySeatRequests(library.id) : Promise.resolve([])),
    [library?.id],
  )

  const shifts = useMemo(() => sortShifts(shiftsQ.data ?? []), [shiftsQ.data])
  const firstActive = shifts.find((s) => s.isActive) ?? shifts[0]
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedShiftId = selectedId ?? firstActive?.id ?? null
  const selectedShift = shifts.find((s) => s.id === selectedShiftId) ?? null

  const [renewMember, setRenewMember] = useState<Member | null>(null)

  if (loading) {
    return (
      <>
        <PageHeader title="Today" />
        <LoadingState layout="cards" count={4} label="Loading your dashboard" />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Today" />
        <ErrorState onRetry={reload} />
      </>
    )
  }

  // No library yet.
  if (state === 'none' || !library) {
    return (
      <>
        <PageHeader title="Today" />
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
        <PageHeader title="Today" />
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
        <PageHeader title="Today" />
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
  const dataLoading = seats.loading || members.loading || shiftsQ.loading
  const dataError = seats.error ?? members.error ?? shiftsQ.error

  const greeting = `Here's ${library.name} on ${formatDate(today)}.`

  // The plan banner is shown in the layout; show only the expired call-out here.
  const expiredCard =
    state === 'expired' ? (
      <Card className="flex flex-wrap items-center justify-between gap-4 border-danger/30 bg-danger-soft p-4 text-danger-ink sm:p-5">
        <div className="flex items-center gap-3">
          <span aria-hidden className="flex size-10 items-center justify-center rounded-full bg-danger-soft [&>svg]:size-5">
            <CalendarClock />
          </span>
          <div>
            <p className="font-medium">Plan expired</p>
            <p className="text-sm tabular-nums">Renew to go live again</p>
          </div>
        </div>
        <Link to="/owner/plan" className={buttonStyles('accent')}>
          Renew plan
        </Link>
      </Card>
    ) : null

  if (dataLoading) {
    return (
      <>
        <PageHeader title="Today" description={greeting} />
        {expiredCard}
        <div className="mt-6">
          <LoadingState layout="cards" count={4} label="Loading your numbers" />
        </div>
      </>
    )
  }

  if (dataError) {
    return (
      <>
        <PageHeader title="Today" description={greeting} />
        {expiredCard}
        <div className="mt-6">
          <ErrorState onRetry={() => { seats.reload(); members.reload(); shiftsQ.reload() }} />
        </div>
      </>
    )
  }

  const allSeats = seats.data ?? []
  const allMembers = members.data ?? []
  const activeMembers = allMembers.filter((m) => m.status === 'active')

  const shiftById = new Map(shifts.map((s) => [s.id, s]))
  const seatNumberById = new Map(allSeats.map((s) => [s.id, s.seatNumber]))
  const seatOf = (m: Member) => (m.seatId ? seatNumberById.get(m.seatId) ?? null : null)
  const feeOf = (m: Member | null) => (m && shiftById.get(m.shiftId)?.monthlyFeePaise) || 0

  // Selected-shift stat cards: counts match the Seats page (same buildSeatCells + seatCounts).
  const selectedCells = selectedShiftId
    ? buildSeatCells(allSeats, allMembers, today, selectedShiftId)
    : []
  const selectedCounts = seatCounts(selectedCells)
  const selectedActive = selectedShiftId
    ? activeMembers.filter((m) => m.shiftId === selectedShiftId).length
    : 0

  const freeByShift = new Map(
    shifts.map((s) => [s.id, seatCounts(buildSeatCells(allSeats, allMembers, today, s.id)).free]),
  )

  // Needs-attention lists cover ALL shifts; a two-shift student appears once per membership.
  const toRow = (m: Member): AttentionRow => ({
    member: m,
    seatNumber: seatOf(m),
    daysLeft: memberDaysLeft(m, today),
    shift: shiftById.get(m.shiftId),
  })

  const overdueAll = activeMembers
    .filter((m) => m.seatId && memberPhase(m, today) === 'expired')
    .map(toRow)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const expiringAll = activeMembers
    .filter((m) => memberPhase(m, today) === 'expiring')
    .map(toRow)
    .sort((a, b) => a.daysLeft - b.daysLeft)

  const recent = activeMembers
    .slice()
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
    .slice(0, 3)
    .map((m) => toDash(m, seatOf(m), today, shiftById.get(m.shiftId)))

  const pendingRequests = (requests.data ?? []).filter((r) => r.status === 'pending')

  return (
    <>
      <PageHeader title="Today" description={greeting} />

      {expiredCard}

      <div className="mt-6">
        <NeedsAttention
          pendingCount={pendingRequests.length}
          overdue={overdueAll.slice(0, ATTENTION_PER_BLOCK)}
          overdueTotal={overdueAll.length}
          expiring={expiringAll.slice(0, ATTENTION_PER_BLOCK)}
          expiringTotal={expiringAll.length}
          libraryName={library.name}
          onRenew={setRenewMember}
        />
      </div>

      {/* Pick a shift; the stat cards below are for this shift only. */}
      {shifts.length > 0 && selectedShiftId && (
        <div className="mt-8">
          <ShiftTabs
            shifts={shifts}
            value={selectedShiftId}
            onChange={setSelectedId}
            detail={(s) => `${freeByShift.get(s.id) ?? 0} free`}
          />
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total seats" value={selectedCounts.total} icon={<Armchair />} />
        <StatCard
          label={selectedShift ? `Occupied in ${selectedShift.name}` : 'Occupied'}
          value={selectedCounts.occupied}
          icon={<UserCheck />}
          tone="primary"
        />
        <StatCard
          label={selectedShift ? `Available in ${selectedShift.name}` : 'Available'}
          value={selectedCounts.free}
          icon={<Armchair />}
        />
        <StatCard
          label={selectedShift ? `Students in ${selectedShift.name}` : 'Active students'}
          value={selectedActive}
          icon={<Users />}
          tone="primary"
        />
      </div>

      {selectedCounts.total > 0 && selectedShift && (
        <Card className="mt-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium tabular-nums">
              {selectedShift.name}: {selectedCounts.free} free · {selectedCounts.occupied} occupied
            </p>
            <Link to="/owner/seats" className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
              Open seat grid
            </Link>
          </div>
          <SeatStrip total={selectedCounts.total} free={selectedCounts.free} className="mt-3" />
        </Card>
      )}

      {/* All shifts at a glance. */}
      {shifts.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="border-b border-border p-4 sm:px-5">
            <h2 className="text-lg font-semibold">All shifts</h2>
          </div>
          <ul className="divide-y divide-border">
            {shifts.map((s) => {
              const counts = seatCounts(buildSeatCells(allSeats, allMembers, today, s.id))
              const studentCount = activeMembers.filter((m) => m.shiftId === s.id).length
              const taken = counts.total - counts.free
              return (
                <li
                  key={s.id}
                  className={`p-4 sm:px-5 ${s.isActive ? '' : 'bg-canvas/60 text-ink-muted'}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {s.name}
                        {!s.isActive && (
                          <span className="rounded-full bg-border px-2 py-0.5 text-xs font-medium text-ink-muted">
                            Off
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-muted tabular-nums">
                        {formatShiftRange(s)} · {formatRupees(s.monthlyFeePaise)} / month
                      </p>
                    </div>
                    <p className="shrink-0 text-right text-sm tabular-nums">
                      <span className="font-medium">{taken} of {counts.total} seats taken</span>
                      <br />
                      <span className="text-ink-muted">
                        {studentCount} student{studentCount === 1 ? '' : 's'}
                        {!s.isActive && studentCount > 0 ? ' still tagged' : ''}
                      </span>
                    </p>
                  </div>
                  {counts.total > 0 && (
                    <SeatStrip total={counts.total} free={counts.free} className="mt-3" />
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      <div className="mt-6">
        <RecentJoins members={recent} />
      </div>

      <RenewModal
        open={!!renewMember}
        onClose={() => setRenewMember(null)}
        member={renewMember}
        shiftFeePaise={feeOf(renewMember)}
        today={today}
        onRenewed={() => {
          members.reload()
          seats.reload()
        }}
      />
    </>
  )
}
