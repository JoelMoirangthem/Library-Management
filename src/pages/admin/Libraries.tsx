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
import { formatShiftCount, formatShiftRange, sortShifts } from '@/domain/shifts'
import type { AdminLibraryRow } from '@/domain/types'

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
        <LoadingState layout="list" label="Loading libraries" />
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
                className="min-h-11 pointer-fine:min-h-9 w-full rounded-control border border-border-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
              {/* Below lg: compact cards (a table doesn't fit next to the sidebar). */}
              <div className="space-y-3 lg:hidden">
                {filtered.map(({ row, state }) => (
                  <LibraryCard
                    key={row.library.id}
                    row={row}
                    now={now}
                    state={state}
                    showRejection={activeTab === 'rejected'}
                    onDetail={() => setDetail(row)}
                    onApprove={() => setApproving(row)}
                    onReject={() => setRejecting(row)}
                  />
                ))}
              </div>

              {/* lg+: one dense row per library, same pattern as the Payments history table. */}
              <Card className="hidden overflow-hidden lg:block">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Libraries</caption>
                  <thead className="border-b border-border bg-canvas text-ink-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-medium">Library</th>
                      <th scope="col" className="px-4 py-3 font-medium">Owner</th>
                      <th scope="col" className="px-4 py-3 font-medium">Area</th>
                      <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Seats</th>
                      <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Shifts</th>
                      <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Submitted</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(({ row, state }) => (
                      <LibraryRow
                        key={row.library.id}
                        row={row}
                        now={now}
                        state={state}
                        showRejection={activeTab === 'rejected'}
                        onDetail={() => setDetail(row)}
                        onApprove={() => setApproving(row)}
                        onReject={() => setRejecting(row)}
                      />
                    ))}
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

type LibraryActionProps = {
  row: AdminLibraryRow
  now: Date
  state: ReturnType<typeof planState>
  showRejection: boolean
  onDetail: () => void
  onApprove: () => void
  onReject: () => void
}

/** Phone card: one compact block, no fixed heights — rows don't need to line up in a column. */
function LibraryCard({ row, now, state, showRejection, onDetail, onApprove, onReject }: LibraryActionProps) {
  const view = planStatusView(state, row.subscription, now)
  const lib = row.library
  const pending = state === 'pending'
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words font-semibold text-ink">{lib.name}</h3>
        <Badge tone={view.tone}>{view.label}</Badge>
      </div>

      <div className="mt-1 text-sm">
        <p className="text-ink">{row.ownerName}</p>
        <TelLink phone={row.ownerPhone} className="whitespace-nowrap text-ink-muted" />
      </div>

      <p className="mt-1 text-sm text-ink-muted">
        {row.areaName}, {row.cityName}
      </p>

      <p className="mt-1 text-xs text-ink-muted tabular-nums">
        {lib.capacity} seats · {formatShiftCount(row.shifts.length)} · submitted {formatDate(lib.createdAt.slice(0, 10))}
      </p>

      {showRejection && (
        <p className="mt-2 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {lib.rejectionReason || ''}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {pending && (
          <>
            <Button variant="primary" className="flex-1 px-3" aria-label={`Approve ${lib.name}`} onClick={onApprove}>
              Approve
            </Button>
            <Button variant="secondary" className="flex-1 px-3" aria-label={`Reject ${lib.name}`} onClick={onReject}>
              Reject
            </Button>
          </>
        )}
        <Button
          variant={pending ? 'ghost' : 'secondary'}
          className={pending ? 'w-full' : 'flex-1 px-3'}
          aria-label={`Details for ${lib.name}`}
          onClick={onDetail}
        >
          Details
        </Button>
      </div>
    </Card>
  )
}

/** One table row per library, from lg up. Repeats "Approve"/"Reject", so labels name the library. */
function LibraryRow({ row, now, state, showRejection, onDetail, onApprove, onReject }: LibraryActionProps) {
  const view = planStatusView(state, row.subscription, now)
  const lib = row.library
  const pending = state === 'pending'
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <p className="break-words font-medium text-ink">{lib.name}</p>
        <div className="mt-1">
          <Badge tone={view.tone}>{view.label}</Badge>
        </div>
        {showRejection && lib.rejectionReason && (
          <p className="mt-1 max-w-64 text-xs text-ink-muted">{lib.rejectionReason}</p>
        )}
      </td>
      <td className="px-4 py-3">
        <p className="text-ink">{row.ownerName}</p>
        <TelLink phone={row.ownerPhone} className="whitespace-nowrap text-ink-muted" />
      </td>
      <td className="px-4 py-3 text-ink-muted">
        {row.areaName}, {row.cityName}
      </td>
      <td className="hidden px-4 py-3 tabular-nums xl:table-cell">{lib.capacity}</td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-ink-muted xl:table-cell">{formatShiftCount(row.shifts.length)}</td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-ink-muted tabular-nums xl:table-cell">
        {formatDate(lib.createdAt.slice(0, 10))}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-2 xl:flex-nowrap">
          {pending && (
            <>
              <Button variant="primary" className="px-3" aria-label={`Approve ${lib.name}`} onClick={onApprove}>
                Approve
              </Button>
              <Button variant="secondary" className="px-3" aria-label={`Reject ${lib.name}`} onClick={onReject}>
                Reject
              </Button>
            </>
          )}
          <Button
            variant={pending ? 'ghost' : 'secondary'}
            className="px-3"
            aria-label={`Details for ${lib.name}`}
            onClick={onDetail}
          >
            Details
          </Button>
        </div>
      </td>
    </tr>
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
