import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, MessageCircle, Phone } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Button, buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { SelectField, TextField } from '@/components/Fields'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/PageParts'
import { ShiftBadge } from '@/components/ShiftTabs'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { ConfirmModal } from '@/components/owner/members'
import { FEE_MODES, formatPhone, whatsappLink } from '@/domain/constants'
import { addDays, formatDate, formatDateTime, todayIST } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import { buildSeatCells, seatCounts } from '@/domain/seatCells'
import { formatShiftRange } from '@/domain/shifts'
import type { FeeMode, Member, RequestStatus, Seat, SeatRequest, Shift } from '@/domain/types'
import { rupeesToPaise } from '@/domain/validation'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { useTitle } from '@/hooks/useTitle'
import { services } from '@/lib/container'
import { useNow } from '@/lib/devState'

const statusBadge: Record<Exclude<RequestStatus, 'pending'>, { tone: BadgeTone; label: string }> = {
  approved: { tone: 'success', label: 'Approved' },
  rejected: { tone: 'danger', label: 'Declined' },
  cancelled: { tone: 'neutral', label: 'Cancelled' },
}

type FreeSeat = { id: string; seatNumber: number }

export default function Requests() {
  useTitle('Requests')
  const now = useNow()
  const today = todayIST(now)
  const { library, canWrite } = useOwnerLibrary()
  const libraryId = library!.id

  const requestsQ = useAsync(() => services.listLibrarySeatRequests(libraryId), [libraryId])
  const seatsQ = useAsync(() => services.listSeats(libraryId), [libraryId])
  const membersQ = useAsync(() => services.listMembers(libraryId), [libraryId])
  const shiftsQ = useAsync(() => services.listShifts(libraryId), [libraryId])

  const requests = useMemo(() => requestsQ.data ?? [], [requestsQ.data])
  const seats = useMemo(() => seatsQ.data ?? [], [seatsQ.data])
  const members = useMemo(() => membersQ.data ?? [], [membersQ.data])
  const shifts = useMemo(() => shiftsQ.data ?? [], [shiftsQ.data])

  const shiftById = useMemo(() => {
    const m = new Map<string, Shift>()
    for (const s of shifts) m.set(s.id, s)
    return m
  }, [shifts])

  const seatsLeftInShift = (shiftId: string) =>
    seatCounts(buildSeatCells(seats, members, today, shiftId)).free

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

  const loading = requestsQ.loading || seatsQ.loading || membersQ.loading || shiftsQ.loading
  const error = requestsQ.error ?? seatsQ.error ?? membersQ.error ?? shiftsQ.error
  const reloadAll = () => {
    requestsQ.reload()
    seatsQ.reload()
    membersQ.reload()
    shiftsQ.reload()
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
              {pending.map((r) => {
                const shift = shiftById.get(r.shiftId) ?? null
                const left = shift ? seatsLeftInShift(shift.id) : 0
                const off = shift ? !shift.isActive : false
                return (
                  <li key={r.id}>
                    <Card className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="break-words font-medium">{r.studentName}</p>
                            <ShiftBadge shift={shift} />
                          </div>
                          <a
                            href={`tel:${r.studentPhone}`}
                            className="mt-0.5 inline-flex min-h-11 items-center gap-1.5 text-sm text-primary underline underline-offset-2"
                          >
                            <Phone aria-hidden className="size-4" />
                            <span className="tabular-nums">{formatPhone(r.studentPhone)}</span>
                          </a>
                          {shift && (
                            <p className="mt-1 text-sm text-ink-muted tabular-nums">
                              {shift.name} · {formatShiftRange(shift)} · {formatRupees(shift.monthlyFeePaise)} / month
                            </p>
                          )}
                          <p className="mt-1 text-sm text-ink-muted tabular-nums">
                            Requested {formatDateTime(r.createdAt)}
                          </p>
                        </div>
                        <Badge tone={off ? 'neutral' : left > 0 ? 'primary' : 'warning'}>
                          {shift
                            ? off
                              ? `${shift.name} is off`
                              : `${left} seat${left === 1 ? '' : 's'} free in ${shift.name}`
                            : 'Shift unavailable'}
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
                )
              })}
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
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words font-medium">{r.studentName}</p>
                          <ShiftBadge shift={shiftById.get(r.shiftId)} />
                        </div>
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
        shift={approveReq ? shiftById.get(approveReq.shiftId) ?? null : null}
        seats={seats}
        members={members}
        today={today}
        libraryName={library!.name}
        onDone={reloadAll}
      />

      <ConfirmModal
        open={!!declineReq}
        onClose={() => setDeclineReq(null)}
        title={declineReq ? `Decline ${declineReq.studentName}'s request?` : 'Decline request?'}
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
  shift,
  seats,
  members,
  today,
  libraryName,
  onDone,
}: {
  request: SeatRequest | null
  onClose: () => void
  shift: Shift | null
  seats: Seat[]
  members: Member[]
  today: string
  libraryName: string
  onDone: () => void
}) {
  const [seatId, setSeatId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [expiryDate, setExpiryDate] = useState(addDays(today, 30))
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<FeeMode>('cash')
  const [error, setError] = useState<string>()
  // After a successful approval: show a "Tell {name}?" step with a WhatsApp link.
  const [done, setDone] = useState<{ seatNumber?: number } | null>(null)

  const feePaise = shift?.monthlyFeePaise ?? 0
  const shiftOff = shift ? !shift.isActive : false

  const freeSeats: FreeSeat[] = useMemo(() => {
    if (!shift) return []
    return buildSeatCells(seats, members, today, shift.id)
      .filter((c) => c.state === 'free')
      .map((c) => ({ id: c.id, seatNumber: c.number }))
  }, [shift, seats, members, today])

  useEffect(() => {
    if (!request) return
    setSeatId(freeSeats[0]?.id ?? '')
    setStartDate(today)
    setExpiryDate(addDays(today, 30))
    setAmount(feePaise ? (feePaise / 100).toString() : '')
    setMode('cash')
    setError(undefined)
    setDone(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, today, feePaise])

  const toastName = request?.studentName ?? ''
  const toastSeat = freeSeats.find((s) => s.id === seatId)?.seatNumber

  const approve = useMutation(services.approveSeatRequest, {
    success:
      toastSeat != null ? `Seat ${toastSeat} assigned to ${toastName}` : `Seat assigned to ${toastName}`,
    onSuccess: () => {
      setDone({ seatNumber: toastSeat })
      onDone()
    },
  })

  const noSeats = freeSeats.length === 0
  const blocked = shiftOff || noSeats

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

  // Success step: confirm and offer a WhatsApp message.
  if (done && request) {
    const welcome = `Hi ${request.studentName}, your ${shift?.name ?? 'study'} seat${
      done.seatNumber != null ? ` (Seat ${done.seatNumber})` : ''
    } at ${libraryName} is confirmed from ${formatDate(startDate)}. See you there!`
    return (
      <Modal
        open
        onClose={onClose}
        title="Seat assigned"
        description={
          done.seatNumber != null
            ? `Seat ${done.seatNumber} is now ${request.studentName}'s.`
            : `${request.studentName} is set up.`
        }
        footer={
          <Button variant="secondary" onClick={onClose}>
            Done
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-card bg-success-soft p-4 text-success-ink">
            <CircleCheck aria-hidden className="size-5 shrink-0" />
            <p className="text-sm font-medium">Tell {request.studentName} the good news?</p>
          </div>
          <a
            href={whatsappLink(request.studentPhone, welcome)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonStyles('primary', 'w-full')}
          >
            <MessageCircle aria-hidden className="size-4" /> Message {request.studentName} on WhatsApp
          </a>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      title={request ? `Approve ${request.studentName}` : 'Approve request'}
      description={shift ? `${shift.name}, ${formatShiftRange(shift)}` : 'Assign a seat and record their first month.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={approve.loading} disabled={blocked}>
            Approve and assign
          </Button>
        </>
      }
    >
      {shiftOff ? (
        <p className="text-sm text-ink-muted">
          {shift!.name} is switched off, so you can't approve this request. Switch the shift back on,
          or decline the request.
        </p>
      ) : noSeats ? (
        <p className="text-sm text-ink-muted">
          {shift ? `${shift.name} is full.` : 'No seats are free.'} Free a seat in this shift or raise
          your capacity on the Seats page, then approve this request. You can also decline it.
        </p>
      ) : (
        <div className="space-y-4">
          <SelectField
            label={`Seat (${freeSeats.length} free in ${shift?.name ?? 'this shift'})`}
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
              hint={`Suggested: ${formatRupees(feePaise)}. Use 0 to skip.`}
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
