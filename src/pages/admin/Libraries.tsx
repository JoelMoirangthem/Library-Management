import { useMemo, useState } from 'react'
import { Phone } from 'lucide-react'
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
  type SegOption,
} from '@/components/admin/AdminBits'
import { formatUntil, planStatusView } from '@/components/admin/planView'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useToast } from '@/components/Toast'
import { services } from '@/lib/container'
import { useNow } from '@/lib/devState'
import { formatDate } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import { extendedActiveUntil, planState, TRIAL_DAYS } from '@/domain/plan'
import type { AdminLibraryRow } from '@/domain/types'

type Tab = 'pending' | 'live' | 'expired' | 'rejected' | 'all'

export default function Libraries() {
  const now = useNow()
  const { data, error, loading, reload } = useAsync(() => services.listLibrariesForAdmin(), [])

  const [tab, setTab] = useState<Tab | null>(null)
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

  // Default tab: Pending if anything waits, else All.
  const activeTab: Tab = tab ?? (counts.pending > 0 ? 'pending' : 'all')

  const filtered = withState.filter(({ state }) => {
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

  const tabs: SegOption<Tab>[] = [
    { value: 'pending', label: 'Pending', count: counts.pending },
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
            <StatCard label="Pending review" value={counts.pending} tone={counts.pending ? 'warning' : 'default'} />
            <StatCard label="Live" value={counts.live} tone="primary" />
            <StatCard label="Expired" value={counts.expired} />
            <StatCard label="Rejected" value={counts.rejected} />
          </div>

          <Segmented options={tabs} value={activeTab} onChange={setTab} ariaLabel="Filter libraries" />

          {filtered.length === 0 ? (
            <EmptyTab tab={activeTab} />
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
                      <th scope="col" className="px-4 py-3 font-medium">Seats</th>
                      <th scope="col" className="px-4 py-3 font-medium">Fee</th>
                      <th scope="col" className="px-4 py-3 font-medium">Submitted</th>
                      <th scope="col" className="px-4 py-3 font-medium">Status</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(({ row, state }) => {
                      const view = planStatusView(state, row.subscription, now)
                      return (
                        <tr key={row.library.id} className="align-top">
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setDetail(row)}
                              className="cursor-pointer text-left font-medium text-ink hover:text-primary hover:underline"
                            >
                              {row.library.name}
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <div>{row.ownerName}</div>
                            <a
                              href={`tel:${row.ownerPhone}`}
                              className="inline-flex items-center gap-1 text-ink-muted tabular-nums hover:text-primary hover:underline"
                            >
                              <Phone aria-hidden className="size-3.5" />
                              {row.ownerPhone}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-ink-muted">
                            {row.areaName}, {row.cityName}
                          </td>
                          <td className="px-4 py-3 tabular-nums">{row.library.capacity}</td>
                          <td className="px-4 py-3 tabular-nums">{formatRupees(row.library.monthlyFeePaise)}</td>
                          <td className="px-4 py-3 tabular-nums text-ink-muted">
                            {formatDate(row.library.createdAt.slice(0, 10))}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={view.tone}>{view.label}</Badge>
                            {state === 'rejected' && row.library.rejectionReason && (
                              <p className="mt-1 max-w-48 text-xs text-ink-muted">{row.library.rejectionReason}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
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
                                <Button variant="ghost" className="px-3" onClick={() => setDetail(row)}>
                                  Details
                                </Button>
                              )}
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
        <button type="button" onClick={onDetail} className="min-w-0 cursor-pointer text-left">
          <h3 className="truncate font-semibold text-ink">{row.library.name}</h3>
          <p className="text-sm text-ink-muted">
            {row.areaName}, {row.cityName}
          </p>
        </button>
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
            <a href={`tel:${row.ownerPhone}`} className="inline-flex items-center gap-1 tabular-nums text-primary">
              <Phone aria-hidden className="size-3.5" />
              {row.ownerPhone}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Seats</dt>
          <dd className="tabular-nums">{row.library.capacity}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Monthly fee</dt>
          <dd className="tabular-nums">{formatRupees(row.library.monthlyFeePaise)}</dd>
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

      <div className="mt-4 flex gap-2">
        {state === 'pending' ? (
          <>
            <Button variant="primary" className="flex-1" onClick={onApprove}>
              Approve
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onReject}>
              Reject
            </Button>
          </>
        ) : (
          <Button variant="secondary" className="flex-1" onClick={onDetail}>
            View details
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
          {row.ownerName} ·{' '}
          <a href={`tel:${row.ownerPhone}`} className="tabular-nums text-primary">
            {row.ownerPhone}
          </a>
        </DetailRow>
        <DetailRow label="Library phone">
          <a href={`tel:${lib.phone}`} className="tabular-nums text-primary">
            {lib.phone}
          </a>
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
        <DetailRow label="Monthly fee">
          <span className="tabular-nums">{formatRupees(lib.monthlyFeePaise)}</span>
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
