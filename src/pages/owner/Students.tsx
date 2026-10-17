import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MoreHorizontal, Phone, RefreshCw, UserPlus } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageHeader } from '@/components/PageParts'
import { ShiftBadge } from '@/components/ShiftTabs'
import { ShowMore } from '@/components/ShowMore'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import {
  AddStudentModal,
  ConfirmModal,
  EditStudentModal,
  ExpiryBadge,
  MemberActionsSheet,
  PaymentsModal,
  RenewModal,
} from '@/components/owner/members'
import { reminderMessage } from '@/components/owner/home/reminder'
import { formatDate, formatDateTime, todayIST } from '@/domain/dates'
import { memberPhase } from '@/domain/members'
import { formatPhone } from '@/domain/constants'
import { formatRupees } from '@/domain/money'
import { sortShifts } from '@/domain/shifts'
import type { FeePayment, Member, Shift } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { usePaged } from '@/hooks/usePaged'
import { useTitle } from '@/hooks/useTitle'
import { services } from '@/lib/container'
import { useNow } from '@/lib/devState'
import { cx } from '@/lib/cx'

type StatusFilter = 'attention' | 'all' | 'expiring' | 'overdue' | 'noSeat'

const FILTERS: StatusFilter[] = ['attention', 'all', 'expiring', 'overdue', 'noSeat']

function isFilter(v: string | null): v is StatusFilter {
  return !!v && (FILTERS as string[]).includes(v)
}

function ReadOnlyNotice({ className }: { className?: string }) {
  return (
    <div className={cx('text-sm text-ink-muted', className)}>
      Renew your plan to make changes.{' '}
      <Link to="/owner/plan" className="font-medium text-primary underline underline-offset-2">
        Go to plan
      </Link>
    </div>
  )
}

export default function Students() {
  useTitle('Students')
  const now = useNow()
  const today = todayIST(now)
  const { library, canWrite } = useOwnerLibrary()
  const libraryId = library!.id

  const seatsQ = useAsync(() => services.listSeats(libraryId), [libraryId])
  const membersQ = useAsync(() => services.listMembers(libraryId), [libraryId])
  const feesQ = useAsync(() => services.listLibraryFees(libraryId), [libraryId])
  const shiftsQ = useAsync(() => services.listShifts(libraryId), [libraryId])

  const seats = useMemo(() => seatsQ.data ?? [], [seatsQ.data])
  const members = useMemo(() => membersQ.data ?? [], [membersQ.data])
  const fees = useMemo(() => feesQ.data ?? [], [feesQ.data])
  const shifts = useMemo(() => sortShifts(shiftsQ.data ?? []), [shiftsQ.data])

  const shiftById = useMemo(() => {
    const m = new Map<string, Shift>()
    for (const s of shifts) m.set(s.id, s)
    return m
  }, [shifts])

  const seatNumberById = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of seats) m.set(s.id, s.seatNumber)
    return m
  }, [seats])

  const latestFeeByMember = useMemo(() => {
    const map = new Map<string, FeePayment>()
    for (const f of fees) {
      if (f.isVoid) continue
      const prev = map.get(f.memberId)
      if (!prev || f.paidOn > prev.paidOn) map.set(f.memberId, f)
    }
    return map
  }, [fees])

  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members])
  const removedMembers = useMemo(() => members.filter((m) => m.status === 'removed'), [members])

  // How many need attention right now (expiring + overdue), to decide the default chip.
  const attentionCount = useMemo(
    () => activeMembers.filter((m) => memberPhase(m, today) !== 'active').length,
    [activeMembers, today],
  )

  // Filter lives in the URL so dashboard "Show all" links land on the right chip.
  const [searchParams, setSearchParams] = useSearchParams()
  const urlFilter = searchParams.get('filter')
  const [status, setStatus] = useState<StatusFilter>(() =>
    isFilter(urlFilter) ? urlFilter : attentionCount > 0 ? 'attention' : 'all',
  )

  // Keep state in sync when the URL changes (e.g. navigating from the dashboard).
  useEffect(() => {
    if (isFilter(urlFilter) && urlFilter !== status) setStatus(urlFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlFilter])

  const setFilter = (next: StatusFilter) => {
    setStatus(next)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'all') p.delete('filter')
        else p.set('filter', next)
        return p
      },
      { replace: true },
    )
  }

  const [query, setQuery] = useState('')
  const [shiftFilter, setShiftFilter] = useState<string>('all')
  const [showRemoved, setShowRemoved] = useState(false)

  const matchesStatus = (m: Member) => {
    const phase = memberPhase(m, today)
    if (status === 'attention') return phase !== 'active'
    if (status === 'expiring') return phase === 'expiring'
    if (status === 'overdue') return phase === 'expired'
    if (status === 'noSeat') return !m.seatId
    return true
  }

  const byShift = useMemo(
    () =>
      shiftFilter === 'all'
        ? activeMembers
        : activeMembers.filter((m) => m.shiftId === shiftFilter),
    [activeMembers, shiftFilter],
  )

  const counts = useMemo(() => {
    let all = 0
    let attention = 0
    let expiring = 0
    let overdue = 0
    let noSeat = 0
    for (const m of byShift) {
      all++
      const phase = memberPhase(m, today)
      if (phase !== 'active') attention++
      if (phase === 'expiring') expiring++
      if (phase === 'expired') overdue++
      if (!m.seatId) noSeat++
    }
    return { all, attention, expiring, overdue, noSeat }
  }, [byShift, today])

  const shiftCounts = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matchesQuery = (m: Member) =>
      !q || m.name.toLowerCase().includes(q) || m.phone.includes(q)
    const base = activeMembers.filter((m) => matchesQuery(m) && matchesStatus(m))
    const map = new Map<string, number>()
    let all = 0
    for (const m of base) {
      all++
      map.set(m.shiftId, (map.get(m.shiftId) ?? 0) + 1)
    }
    return { all, map }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembers, query, status, today])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matchesQuery = (m: Member) =>
      !q || m.name.toLowerCase().includes(q) || m.phone.includes(q)

    const filtered = activeMembers.filter((m) => {
      if (!matchesQuery(m)) return false
      if (shiftFilter !== 'all' && m.shiftId !== shiftFilter) return false
      return matchesStatus(m)
    })

    return filtered.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembers, query, status, shiftFilter, today])

  const paged = usePaged(visible, 25, `${status}|${query}|${shiftFilter}`)

  // Modal state
  const [addOpen, setAddOpen] = useState(false)
  const [renewMember, setRenewMember] = useState<Member | null>(null)
  const [editMember, setEditMember] = useState<Member | null>(null)
  const [paymentsMember, setPaymentsMember] = useState<Member | null>(null)
  const [removeMember, setRemoveMember] = useState<Member | null>(null)
  const [moreMember, setMoreMember] = useState<Member | null>(null)

  const remove = useMutation(services.removeMember, { success: 'Student removed' })
  const feeFor = (m: Member | null) =>
    (m && shiftById.get(m.shiftId)?.monthlyFeePaise) || 0

  const makeReminder = (m: Member) =>
    reminderMessage({
      name: m.name,
      shift: shiftById.get(m.shiftId)?.name ?? 'study',
      library: library!.name,
      expiry: m.expiryDate,
    })

  const loading = seatsQ.loading || membersQ.loading || feesQ.loading || shiftsQ.loading
  const error = seatsQ.error ?? membersQ.error ?? feesQ.error ?? shiftsQ.error
  const reloadAll = () => {
    seatsQ.reload()
    membersQ.reload()
    feesQ.reload()
    shiftsQ.reload()
  }

  const statusChips: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'attention', label: 'Needs attention', count: counts.attention },
    { key: 'all', label: 'All', count: counts.all },
    { key: 'expiring', label: 'Expiring', count: counts.expiring },
    { key: 'overdue', label: 'Overdue', count: counts.overdue },
    { key: 'noSeat', label: 'No seat', count: counts.noSeat },
  ]

  return (
    <>
      <PageHeader
        title="Students"
        description="Everyone at your library. Status comes from each student's expiry date."
        actions={
          canWrite ? (
            <Button onClick={() => setAddOpen(true)}>
              <UserPlus aria-hidden className="size-4" /> Add student
            </Button>
          ) : undefined
        }
      />

      {!canWrite && <ReadOnlyNotice className="mb-4" />}

      {loading ? (
        <LoadingState label="Loading students" />
      ) : error ? (
        <ErrorState onRetry={reloadAll} />
      ) : members.length === 0 ? (
        <EmptyState
          title="No students yet"
          description="Add your first student to start tracking seats and fees."
          action={
            canWrite ? (
              <Button onClick={() => setAddOpen(true)}>
                <UserPlus aria-hidden className="size-4" /> Add student
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {/* Search + filters */}
          <div className="space-y-3">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or phone"
              aria-label="Search students by name or phone"
              className="block min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-muted/70"
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {statusChips.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={status === c.key}
                  onClick={() => setFilter(c.key)}
                  className={cx(
                    'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                    status === c.key
                      ? 'border-primary bg-primary-soft text-primary-ink'
                      : 'border-border-strong bg-surface text-ink hover:bg-canvas',
                  )}
                >
                  {c.label}
                  <span className="tabular-nums">{c.count}</span>
                </button>
              ))}
            </div>
            {shifts.length > 1 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by shift">
                <button
                  type="button"
                  aria-pressed={shiftFilter === 'all'}
                  onClick={() => setShiftFilter('all')}
                  className={cx(
                    'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                    shiftFilter === 'all'
                      ? 'border-primary bg-primary-soft text-primary-ink'
                      : 'border-border-strong bg-surface text-ink hover:bg-canvas',
                  )}
                >
                  All shifts
                  <span className="tabular-nums">{shiftCounts.all}</span>
                </button>
                {shifts.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={shiftFilter === s.id}
                    onClick={() => setShiftFilter(s.id)}
                    className={cx(
                      'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors',
                      shiftFilter === s.id
                        ? 'border-primary bg-primary-soft text-primary-ink'
                        : 'border-border-strong bg-surface text-ink hover:bg-canvas',
                    )}
                  >
                    {s.name}
                    {!s.isActive && ' (off)'}
                    <span className="tabular-nums">{shiftCounts.map.get(s.id) ?? 0}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {visible.length === 0 ? (
            <Card className="p-8 text-center text-ink-muted">No students match this filter.</Card>
          ) : (
            <>
              <p className="text-sm text-ink-muted tabular-nums" aria-live="polite">
                {visible.length} student{visible.length === 1 ? '' : 's'}
              </p>

              {/* Desktop table */}
              <Card className="hidden overflow-hidden md:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">
                    Students at {library!.name}, sorted by soonest expiry
                  </caption>
                  <thead className="border-b border-border bg-canvas text-ink-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Student</th>
                      <th scope="col" className="px-4 py-3 font-medium">Shift</th>
                      <th scope="col" className="px-4 py-3 font-medium">Seat</th>
                      <th scope="col" className="px-4 py-3 font-medium">Expires</th>
                      <th scope="col" className="px-4 py-3 font-medium">Last payment</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paged.visible.map((m) => {
                      const seatNo = m.seatId ? seatNumberById.get(m.seatId) : undefined
                      const fee = latestFeeByMember.get(m.id)
                      return (
                        <tr key={m.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium">{m.name}</p>
                            <a
                              href={`tel:${m.phone}`}
                              className="inline-flex min-h-11 items-center gap-1 text-ink-muted hover:text-primary"
                            >
                              <Phone aria-hidden className="size-3.5" />
                              <span className="tabular-nums">{formatPhone(m.phone)}</span>
                            </a>
                          </td>
                          <td className="px-4 py-3">
                            <ShiftBadge shift={shiftById.get(m.shiftId)} />
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {seatNo ? `Seat ${seatNo}` : <span className="text-ink-muted">No seat</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="tabular-nums">{formatDate(m.expiryDate)}</span>
                              <ExpiryBadge member={m} today={today} />
                            </div>
                          </td>
                          <td className="px-4 py-3 tabular-nums">
                            {fee ? (
                              `${formatRupees(fee.amountPaise)} · ${formatDate(fee.paidOn)}`
                            ) : (
                              <span className="text-ink-muted">No payment</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                              {canWrite && (
                                <Button variant="ghost" className="min-h-11 px-3" onClick={() => setRenewMember(m)}>
                                  <RefreshCw aria-hidden className="size-4" /> Renew
                                </Button>
                              )}
                              <Button
                                variant="secondary"
                                className="min-h-11 px-3"
                                aria-haspopup="dialog"
                                aria-label={`More actions for ${m.name}`}
                                onClick={() => setMoreMember(m)}
                              >
                                <MoreHorizontal aria-hidden className="size-4" /> More
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>

              {/* Phone cards */}
              <ul className="space-y-3 md:hidden">
                {paged.visible.map((m) => {
                  const seatNo = m.seatId ? seatNumberById.get(m.seatId) : undefined
                  const fee = latestFeeByMember.get(m.id)
                  return (
                    <li key={m.id}>
                      <Card className="flex min-h-full flex-col p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words font-medium">{m.name}</p>
                              <ShiftBadge shift={shiftById.get(m.shiftId)} />
                            </div>
                            <a
                              href={`tel:${m.phone}`}
                              className="inline-flex min-h-11 items-center gap-1 text-sm text-ink-muted hover:text-primary"
                            >
                              <Phone aria-hidden className="size-3.5" />
                              <span className="tabular-nums">{formatPhone(m.phone)}</span>
                            </a>
                          </div>
                          <ExpiryBadge member={m} today={today} />
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <dt className="text-ink-muted">Seat</dt>
                            <dd className="tabular-nums">{seatNo ? `Seat ${seatNo}` : 'No seat'}</dd>
                          </div>
                          <div>
                            <dt className="text-ink-muted">Expires</dt>
                            <dd className="tabular-nums">{formatDate(m.expiryDate)}</dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-ink-muted">Last payment</dt>
                            <dd className="tabular-nums">
                              {fee ? `${formatRupees(fee.amountPaise)} · ${formatDate(fee.paidOn)}` : 'No payment'}
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                          {canWrite && (
                            <Button className="flex-1" onClick={() => setRenewMember(m)}>
                              <RefreshCw aria-hidden className="size-4" /> Renew
                            </Button>
                          )}
                          <Button
                            variant="secondary"
                            className={canWrite ? 'px-4' : 'flex-1'}
                            aria-haspopup="dialog"
                            aria-label={`More actions for ${m.name}`}
                            onClick={() => setMoreMember(m)}
                          >
                            <MoreHorizontal aria-hidden className="size-4" /> More
                          </Button>
                        </div>
                      </Card>
                    </li>
                  )
                })}
              </ul>

              <ShowMore
                shown={paged.shown}
                total={paged.total}
                onClick={paged.showMore}
                noun="students"
              />
            </>
          )}

          {/* Removed students */}
          {removedMembers.length > 0 && (
            <div className="pt-2">
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={showRemoved}
                  onChange={(e) => setShowRemoved(e.target.checked)}
                />
                Show removed students ({removedMembers.length})
              </label>
              {showRemoved && (
                <ul className="mt-3 divide-y divide-border rounded-card border border-border bg-surface">
                  {removedMembers.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 p-4 text-ink-muted">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-medium">{m.name}</p>
                          <ShiftBadge shift={shiftById.get(m.shiftId)} />
                        </div>
                        <span className="tabular-nums text-sm">{formatPhone(m.phone)}</span>
                      </div>
                      <Badge tone="neutral">
                        Removed{m.removedAt ? ` ${formatDateTime(m.removedAt)}` : ''}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Shared modals */}
      <AddStudentModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        libraryId={libraryId}
        shifts={shifts}
        seats={seats}
        members={members}
        today={today}
        onAdded={(name) => {
          // Show the new student straight away instead of hiding them behind the default filter.
          setFilter('all')
          setQuery(name)
        }}
      />
      <RenewModal
        open={!!renewMember}
        onClose={() => setRenewMember(null)}
        member={renewMember}
        shiftFeePaise={feeFor(renewMember)}
        today={today}
      />
      <EditStudentModal open={!!editMember} onClose={() => setEditMember(null)} member={editMember} />
      <PaymentsModal
        open={!!paymentsMember}
        onClose={() => setPaymentsMember(null)}
        member={paymentsMember}
        shiftFeePaise={feeFor(paymentsMember)}
        today={today}
        canWrite={canWrite}
      />
      <MemberActionsSheet
        member={moreMember}
        shift={moreMember ? shiftById.get(moreMember.shiftId) : undefined}
        reminderMessage={makeReminder}
        canWrite={canWrite}
        onClose={() => setMoreMember(null)}
        onEdit={() => {
          const m = moreMember
          setMoreMember(null)
          setEditMember(m)
        }}
        onPayments={() => {
          const m = moreMember
          setMoreMember(null)
          setPaymentsMember(m)
        }}
        onRemove={() => {
          const m = moreMember
          setMoreMember(null)
          setRemoveMember(m)
        }}
      />
      <ConfirmModal
        open={!!removeMember}
        onClose={() => setRemoveMember(null)}
        title={removeMember ? `Remove ${removeMember.name}?` : 'Remove student?'}
        description="Their seat becomes free and their payment history is kept."
        confirmLabel="Remove student"
        loading={remove.loading}
        onConfirm={async () => {
          if (!removeMember) return
          const ok = await remove.run(removeMember.id)
          if (ok !== undefined) setRemoveMember(null)
        }}
      />
    </>
  )
}
