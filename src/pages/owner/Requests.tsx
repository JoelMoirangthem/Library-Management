import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { SelectField, TextField } from '@/components/Fields'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/PageParts'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { ConfirmModal } from '@/components/owner/members'
import { FEE_MODES } from '@/domain/constants'
import { addDays, formatDateTime, todayIST } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import { buildSeatCells, seatCounts } from '@/domain/seatCells'
import type { FeeMode, RequestStatus, SeatRequest } from '@/domain/types'
import { rupeesToPaise } from '@/domain/validation'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { services } from '@/lib/container'
import { useNow } from '@/lib/devState'

const statusBadge: Record<Exclude<RequestStatus, 'pending'>, { tone: BadgeTone; label: string }> = {
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Declined' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
}

type FreeSeat = { id: string; seatNumber: number }

export default function Requests() {
  const now = useNow()
  const today = todayIST(now)
  const { library, canWrite } = useOwnerLibrary()
  const libraryId = library!.id

  const requestsQ = useAsync(() => services.listLibrarySeatRequests(libraryId), [libraryId])
  const seatsQ = useAsync(() => services.listSeats(libraryId), [libraryId])
  const membersQ = useAsync(() => services.listMembers(libraryId), [libraryId])

  const requests = useMemo(() => requestsQ.data ?? [], [requestsQ.data])
  const seats = useMemo(() => seatsQ.data ?? [], [seatsQ.data])
  const members = useMemo(() => membersQ.data ?? [], [membersQ.data])

  const cells = useMemo(() => buildSeatCells(seats, members, today), [seats, members, today])
  const counts = useMemo(() => seatCounts(cells), [cells])
  const freeSeats: FreeSeat[] = useMemo(
    () => cells.filter((c) => c.state === 'free').map((c) => ({ id: c.id, seatNumber: c.number })),
    [cells],
  )

  const pending = useMemo(
    () =>
      requests
        .filter((r) => r.status === 'pending')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [requests],
  )
  const history = useMemo(
    () =>
      requests
        .filter((r) => r.status !== 'pending')
        .sort((a, b) => (b.decidedAt ?? b.createdAt).localeCompare(a.decidedAt ?? a.createdAt)),
    [requests],
  )

  const [approveReq, setApproveReq] = useState<SeatRequest | null>(null)
  const [declineReq, setDeclineReq] = useState<SeatRequest | null>(null)

  const reject = useMutation(services.rejectSeatRequest, { success: 'Request declined' })

  const loading = requestsQ.loading || seatsQ.loading || membersQ.loading
  const error = requestsQ.error ?? seatsQ.error ?? membersQ.error
  const reloadAll = () => {
    requestsQ.reload()
    seatsQ.reload()
    membersQ.reload()
  }

  return (
    <>
      <PageHeader title="Requests" description="Students who want a seat at your library." />

      {!canWrite && (
        <p className="mb-4 text-sm text-ink-muted">
          Renew your plan to make changes.{' '}
          <Link to="/owner/plan" className="font-medium text-primary underline underline-offset-2">
            Go to plan
          </Link>
        </p>
      )}

      {loading ? (
        <LoadingState label="Loading requests" />
      ) : error ? (
        <ErrorState onRetry={reloadAll} />
      ) : pending.length === 0 && history.length === 0 ? (
        <EmptyState
          title="No requests right now"
          description="Students who find your library can request a seat from its page."
        />
      ) : (
        <div className="space-y-8">
          {pending.length > 0 ? (
            <ul className="space-y-3">
              {pending.map((r) => (
                <li key={r.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{r.studentName}</p>
                        <a
                          href={`tel:${r.studentPhone}`}
                          className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2"
                        >
                          <Phone aria-hidden className="size-4" />
                          <span className="tabular-nums">{r.studentPhone}</span>
                        </a>
                        <p className="mt-1 text-sm text-ink-muted tabular-nums">
                          Requested {formatDateTime(r.createdAt)}
                        </p>
                      </div>
                      <Badge tone={counts.free > 0 ? 'primary' : 'warning'}>
                        <span className="tabular-nums">{counts.free}</span> seats left
                      </Badge>
                    </div>
                    {canWrite && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button onClick={() => setApproveReq(r)}>Approve</Button>
                        <Button variant="secondary" onClick={() => setDeclineReq(r)}>
                          Decline
                        </Button>
                      </div>
                    )}
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-muted">No pending requests right now.</p>
          )}

          {history.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-semibold">Earlier requests</h2>
              <ul className="divide-y divide-border rounded-card border border-border bg-surface">
                {history.map((r) => {
                  const b = statusBadge[r.status as Exclude<RequestStatus, 'pending'>]
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <p className="font-medium">{r.studentName}</p>
                        <p className="text-sm text-ink-muted tabular-nums">
                          {formatDateTime(r.decidedAt ?? r.createdAt)}
                        </p>
                      </div>
                      <Badge tone={b.tone}>{b.label}</Badge>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </div>
      )}

      <ApproveModal
        request={approveReq}
        onClose={() => setApproveReq(null)}
        freeSeats={freeSeats}
        monthlyFeePaise={library!.monthlyFeePaise}
        today={today}
      />

      <ConfirmModal
        open={!!declineReq}
        onClose={() => setDeclineReq(null)}
        title={declineReq ? `Decline ${declineReq.studentName}’s request?` : 'Decline request?'}
        description="The student is told their request was not accepted."
        confirmLabel="Decline request"
        loading={reject.loading}
        onConfirm={async () => {
          if (!declineReq) return
          const ok = await reject.run(declineReq.id)
          if (ok !== undefined) setDeclineReq(null)
        }}
      />
    </>
  )
}

function ApproveModal({
  request,
  onClose,
  freeSeats,
  monthlyFeePaise,
  today,
}: {
  request: SeatRequest | null
  onClose: () => void
  freeSeats: FreeSeat[]
  monthlyFeePaise: number
  today: string
}) {
  const [seatId, setSeatId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [expiryDate, setExpiryDate] = useState(addDays(today, 30))
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<FeeMode>('cash')
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!request) return
    setSeatId(freeSeats[0]?.id ?? '')
    setStartDate(today)
    setExpiryDate(addDays(today, 30))
    setAmount((monthlyFeePaise / 100).toString())
    setMode('cash')
    setError(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, today, monthlyFeePaise])

  const toastName = request?.studentName ?? ''
  const toastSeat = freeSeats.find((s) => s.id === seatId)?.seatNumber

  const approve = useMutation(services.approveSeatRequest, {
    success:
      toastSeat != null ? `Seat ${toastSeat} assigned to ${toastName}` : `Seat assigned to ${toastName}`,
    onSuccess: () => onClose(),
  })

  const noSeats = freeSeats.length === 0

  const submit = async () => {
    setError(undefined)
    if (!request) return
    if (!seatId) {
      setError('Choose a free seat.')
      return
    }
    if (expiryDate < startDate) {
      setError('Expiry must be on or after the start date.')
      return
    }
    const paise = amount.trim() === '' ? 0 : rupeesToPaise(amount)
    if (paise === null) {
      setError('Enter the amount in rupees, or 0 to skip.')
      return
    }
    await approve.run({
      requestId: request.id,
      seatId,
      startDate,
      expiryDate,
      amountPaise: paise,
      mode,
    })
  }

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      title={request ? `Approve ${request.studentName}` : 'Approve request'}
      description="Assign a seat and record their first month."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={approve.loading} disabled={noSeats}>
            Approve and assign
          </Button>
        </>
      }
    >
      {noSeats ? (
        <p className="text-sm text-ink-muted">
          No seats are free. Free a seat or raise your capacity on the Seats page, then approve this
          request.
        </p>
      ) : (
        <div className="space-y-4">
          <SelectField
            label={`Seat (${freeSeats.length} free)`}
            value={seatId}
            onChange={(e) => setSeatId(e.target.value)}
          >
            {freeSeats.map((s) => (
              <option key={s.id} value={s.id}>
                Seat {s.seatNumber}
              </option>
            ))}
          </SelectField>
          <TextField label="Start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <TextField
            label="Expiry date"
            type="date"
            value={expiryDate}
            min={startDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="First payment"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              hint={`Suggested: ${formatRupees(monthlyFeePaise)}. Use 0 to skip.`}
            />
            <SelectField label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value as FeeMode)}>
              {FEE_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </SelectField>
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
