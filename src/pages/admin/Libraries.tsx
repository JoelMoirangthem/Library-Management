import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Modal } from '@/components/Modal'
import { PageHeader, StatCard } from '@/components/PageParts'
import { TextAreaField } from '@/components/Fields'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import {
  DetailRow,
  Segmented,
  TelLink,
  type SegOption,
} from '@/components/admin/AdminBits'
import { formatUntil, planStatusView } from '@/components/admin/planView'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useToast } from '@/components/Toast'
import { useTitle } from '@/hooks/useTitle'
import { services } from '@/lib/container'
import { useNow } from '@/lib/devState'
import { formatDate } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import { normalizePhone } from '@/domain/constants'
import { extendedActiveUntil, planState, TRIAL_DAYS } from '@/domain/plan'
import { formatShiftRange, sortShifts } from '@/domain/shifts'
import type { AdminLibraryRow, Shift } from '@/domain/types'

/** Compact shift chips for the table and cards: 'Morning ₹800', switched-off ones muted with 'off'. */
function ShiftChips({ shifts }: { shifts: Shift[] }) {
  if (shifts.length === 0) return <span className="text-ink-muted">—</span>
  return (
    <ul className="flex flex-wrap gap-1.5">
      {sortShifts(shifts).map((s) => (
        <li key={s.id}>
          <Badge tone={s.isActive ? 'primary' : 'neutral'}>
            <span className="tabular-nums">
              {s.name} {formatRupees(s.monthlyFeePaise)}
              {!s.isActive && ' · off'}
            </span>
          </Badge>
        </li>
      ))}
    </ul>
  )
}

type Tab = 'pending' | 'live' | 'expired' | 'rejected' | 'all'

export default function Libraries() {
  useTitle('Libraries')
  const now = useNow()
  const { data, error, loading, reload } = useAsync(() => services.listLibrariesForAdmin(), [])

  const [tab, setTab] = useState<Tab | null>(null)
  const [query, setQuery] = useState('')
  const [detail, setDetail] = useState<AdminLibraryRow | null>(null)
  const [approving, setApproving] = useState<AdminLibraryRow | null>(null)
  const [rejecting, setRejecting] = useState<AdminLibraryRow | null>(null)

  const rows = useMemo(() => data ?? [], [data])
  const withState = useMemo(
    () => rows.map((row) => ({ row, state: planState(row.library, row.subscription, now) })),
    [rows, now],
  )

  const counts = useMemo(() => {
    let pending = 0
    let live = 0
    let expired = 0
    let rejected = 0
    for (const { state } of withState) {
      if (state === 'pending') pending++
      else if (state === 'trial' || state === 'paid') live++
      else if (state === 'expired') expired++
      else if (state === 'rejected') rejected++
    }
    return { pending, live, expired, rejected }
  }, [withState])

  // Default tab: Needs review if anything waits, else All.
  const activeTab: Tab = tab ?? (counts.pending > 0 ? 'pending' : 'all')

  const byTab = withState.filter(({ state }) => {
    switch (activeTab) {
      case 'pending':
        return state === 'pending'
      case 'live':
        return state === 'trial' || state === 'paid'
      case 'expired':
        return state === 'expired'
      case 'rejected':
        return state === 'rejected'
      case 'all':
        return true
    }
  })

  const q = query.trim().toLowerCase()
  const searched = q
    ? byTab.filter(({ row }) => {
        const hay = `${row.library.name} ${row.ownerName} ${row.areaName} ${row.cityName}`.toLowerCase()
        if (hay.includes(q)) return true
        const digits = normalizePhone(q)
        return digits.length > 0 && normalizePhone(row.ownerPhone).includes(digits)
      })
    : byTab

  // Pending reviewed oldest-first so nothing is missed; others newest-first.
  const filtered = [...searched].sort((a, b) => {
    const ta = Date.parse(a.row.library.createdAt)
    const tb = Date.parse(b.row.library.createdAt)
    return activeTab === 'pending' ? ta - tb : tb - ta
  })

  const tabs: SegOption<Tab>[] = [
    { value: 'pending', label: 'Needs review', count: counts.pending },
    { value: 'live', label: 'Live', count: counts.live },
    { value: 'expired', label: 'Expired', count: counts.expired },
    { value: 'rejected', label: 'Rejected', count: counts.rejected },
    { value: 'all', label: 'All', count: withState.length },
  ]

  return (
    <>
      <PageHeader title="Libraries" description="Review new libraries and keep an eye on plans." />

      {loading ? (
        <LoadingState layout="cards" label="Loading libraries" />
      ) : error ? (
        <ErrorState onRetry={reload} />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Needs review" value={counts.pending} tone={counts.pending ? 'warning' : 'default'} />
            <StatCard label="Live" value={counts.live} tone="primary" />
            <StatCard label="Expired" value={counts.expired} />
            <StatCard label="Rejected" value={counts.rejected} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <Segmented options={tabs} value={activeTab} onChange={setTab} ariaLabel="Filter libraries" />
            <div className="relative sm:w-64">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, owner or area"
                aria-label="Search libraries"
                className="min-h-11 w-full rounded-control border border-border-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            q ? (
              <EmptyState title="No matches" description="Try a different name, owner or area." />
            ) : (
              <EmptyTab tab={activeTab} />
            )
          ) : (
            <>
              {/* Phone: cards */}
              <div className="space-y-3 md:hidden">
                {filtered.map(({ row, state }) => (
                  <LibraryCard
                    key={row.library.id}
                    row={row}
                    now={now}
                    state={state}
                    onDetail={() => setDetail(row)}
                    onApprove={() => setApproving(row)}
                    onReject={() => setRejecting(row)}
                  />
                ))}
              </div>

              {/* md+: table */}
              <Card className="hidden overflow-hidden md:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-canvas text-ink-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Library</th>
                      <th scope="col" className="px-4 py-3 font-medium">Owner</th>
                      <th scope="col" className="px-4 py-3 font-medium">Location</th>
                      <th scope="col" className="px-4 py-3 font-medium">Shifts</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Status and actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(({ row, state }) => {
                      const view = planStatusView(state, row.subscription, now)
                      return (
                        <tr key={row.library.id} className="align-top">
                          <td className="px-4 py-3">
                            <div className="font-medium text-ink">{row.library.name}</div>
                            <div className="text-xs text-ink-muted tabular-nums">
                              {row.library.capacity} seats · submitted {formatDate(row.library.createdAt.slice(0, 10))}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>{row.ownerName}</div>
                            <TelLink phone={row.ownerPhone} className="text-ink-muted" />
                          </td>
                          <td className="px-4 py-3 text-ink-muted">
                            {row.areaName}, {row.cityName}
                          </td>
                          <td className="px-4 py-3">
                            <ShiftChips shifts={row.shifts} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col items-end gap-2">
                              <Badge tone={view.tone}>{view.label}</Badge>
                              {state === 'rejected' && row.library.rejectionReason && (
                                <p className="max-w-48 text-right text-xs text-ink-muted">{row.library.rejectionReason}</p>
                              )}
                              <div className="flex flex-wrap justify-end gap-2">
                                {state === 'pending' ? (
                                  <>
                                    <Button variant="primary" className="px-3" onClick={() => setApproving(row)}>
                                      Approve
                                    </Button>
                                    <Button variant="secondary" className="px-3" onClick={() => setRejecting(row)}>
                                      Reject
                                    </Button>
                                  </>
                                ) : (
                                  <Button variant="secondary" className="px-3" onClick={() => setDetail(row)}>
                                    Details
                                  </Button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
      )}

      <DetailModal row={detail} now={now} onClose={() => setDetail(null)} />
      <ApproveModal row={approving} onClose={() => setApproving(null)} />
      <RejectModal row={rejecting} onClose={() => setRejecting(null)} />
    </>
  )
}

function EmptyTab({ tab }: { tab: Tab }) {
  const copy: Record<Tab, { title: string; description: string }> = {
    pending: { title: 'Nothing waiting for review', description: 'New libraries appear here when owners submit them.' },
    live: { title: 'No live libraries yet', description: 'Approved libraries on a trial or paid plan show here.' },
    expired: { title: 'No expired libraries', description: 'Libraries whose plan has lapsed show here.' },
    rejected: { title: 'No rejected libraries', description: 'Libraries you turned down show here with their reason.' },
    all: { title: 'No libraries yet', description: 'Everything owners submit will show here.' },
  }
  return <EmptyState title={copy[tab].title} description={copy[tab].description} />
}

function LibraryCard({
  row,
  now,
  state,
  onDetail,
  onApprove,
  onReject,
}: {
  row: AdminLibraryRow
  now: Date
  state: ReturnType<typeof planState>
  onDetail: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const view = planStatusView(state, row.subscription, now)
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-ink">{row.library.name}</h3>
          <p className="text-sm text-ink-muted">
            {row.areaName}, {row.cityName}
          </p>
        </div>
        <Badge tone={view.tone}>{view.label}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <dt className="text-ink-muted">Owner</dt>
          <dd>{row.ownerName}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Phone</dt>
          <dd>
            <TelLink phone={row.ownerPhone} />
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Seats</dt>
          <dd className="tabular-nums">{row.library.capacity}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink-muted">Shifts</dt>
          <dd className="mt-1">
            <ShiftChips shifts={row.shifts} />
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink-muted">Submitted</dt>
          <dd className="tabular-nums">{formatDate(row.library.createdAt.slice(0, 10))}</dd>
        </div>
      </dl>

      {state === 'rejected' && row.library.rejectionReason && (
        <p className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {row.library.rejectionReason}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {state === 'pending' ? (
          <>
            <Button variant="primary" className="flex-1" onClick={onApprove}>
              Approve
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onReject}>
              Reject
            </Button>
            <Button variant="ghost" className="w-full" onClick={onDetail}>
              Details
            </Button>
          </>
        ) : (
          <Button variant="secondary" className="flex-1" onClick={onDetail}>
            Details
          </Button>
        )}
      </div>
    </Card>
  )
}

function DetailModal({ row, now, onClose }: { row: AdminLibraryRow | null; now: Date; onClose: () => void }) {
  if (!row) return null
  const lib = row.library
  const view = planStatusView(planState(lib, row.subscription, now), row.subscription, now)
  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title={lib.name}
      description={`${row.areaName}, ${row.cityName}`}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="mb-4">
        <Badge tone={view.tone}>{view.label}</Badge>
      </div>
      <dl className="divide-y divide-border">
        <DetailRow label="Owner">
          <span className="flex flex-wrap items-center gap-x-2">
            {row.ownerName}
            <TelLink phone={row.ownerPhone} />
          </span>
        </DetailRow>
        <DetailRow label="Library phone">
          <TelLink phone={lib.phone} />
        </DetailRow>
        <DetailRow label="Address">{lib.address}</DetailRow>
        <DetailRow label="Landmark">{lib.landmark || '—'}</DetailRow>
        <DetailRow label="Pincode">
          <span className="tabular-nums">{lib.pincode}</span>
        </DetailRow>
        <DetailRow label="Timings">{lib.timings}</DetailRow>
        <DetailRow label="Seats">
          <span className="tabular-nums">{lib.capacity}</span>
        </DetailRow>
        <DetailRow label="Shifts">
          <ul className="space-y-1.5">
            {sortShifts(row.shifts).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-ink">{s.name}</span>
                <span className="text-ink-muted tabular-nums">{formatShiftRange(s)}</span>
                <span className="tabular-nums">· {formatRupees(s.monthlyFeePaise)} / month</span>
                <Badge tone={s.isActive ? 'success' : 'neutral'}>{s.isActive ? 'On' : 'Off'}</Badge>
              </li>
            ))}
          </ul>
        </DetailRow>
        <DetailRow label="Amenities">
          {lib.amenities.length ? lib.amenities.join(', ') : '—'}
        </DetailRow>
        {lib.rejectionReason && <DetailRow label="Rejection reason">{lib.rejectionReason}</DetailRow>}
      </dl>
    </Modal>
  )
}

function ApproveModal({ row, onClose }: { row: AdminLibraryRow | null; onClose: () => void }) {
  const now = useNow()
  const toast = useToast()
  const { run, loading } = useMutation(services.approveLibrary, { silent: true })

  if (!row) return null
  const trialEnds = formatUntil(extendedActiveUntil(null, now, TRIAL_DAYS))

  async function submit() {
    if (!row) return
    const ok = await run(row.library.id)
    if (ok !== undefined) {
      toast.show(`Approved. Trial ends ${trialEnds}`, 'success')
      onClose()
    }
  }

  return (
    <Modal
      open={!!row}
      onClose={onClose}
      title="Approve this library?"
      description={`This starts the ${TRIAL_DAYS}-day free trial and creates ${row.library.capacity} seats.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} onClick={() => void submit()}>
            Approve library
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">
        {row.library.name} will go live and appear to students. The trial runs until{' '}
        <span className="font-medium text-ink tabular-nums">{trialEnds}</span>.
      </p>
      {row.shifts.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-ink">Shifts the owner set up</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {sortShifts(row.shifts).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium text-ink">{s.name}</span>
                <span className="text-ink-muted tabular-nums">{formatShiftRange(s)}</span>
                <span className="tabular-nums">· {formatRupees(s.monthlyFeePaise)} / month</span>
                {!s.isActive && <Badge tone="neutral">Off</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}

function RejectModal({ row, onClose }: { row: AdminLibraryRow | null; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const { run, loading } = useMutation(services.rejectLibrary, { success: 'Library rejected' })

  const trimmed = reason.trim()
  const invalid = trimmed.length === 0

  async function submit() {
    if (!row) return
    setTouched(true)
    if (invalid) return
    const ok = await run(row.library.id, trimmed)
    if (ok !== undefined) {
      setReason('')
      setTouched(false)
      onClose()
    }
  }

  function close() {
    setReason('')
    setTouched(false)
    onClose()
  }

  if (!row) return null

  return (
    <Modal
      open={!!row}
      onClose={close}
      title="Reject this library?"
      description={`Tell ${row.ownerName} what to fix before resubmitting.`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" loading={loading} onClick={() => void submit()}>
            Reject library
          </Button>
        </>
      }
    >
      <TextAreaField
        label="Reason"
        hint="The owner sees this and can fix and resubmit."
        error={touched && invalid ? 'Add a reason so the owner knows what to fix.' : undefined}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
      />
    </Modal>
  )
}
