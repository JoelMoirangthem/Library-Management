import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/Fields'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/PageParts'
import { SeatGrid } from '@/components/SeatGrid'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import {
  AddStudentModal,
  ConfirmModal,
  ExpiryBadge,
  RenewModal,
} from '@/components/owner/members'
import { buildSeatCells } from '@/domain/seatCells'
import { todayIST, formatDate } from '@/domain/dates'
import type { Member } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { services } from '@/lib/container'
import { useNow } from '@/lib/devState'

function ReadOnlyNotice() {
  return (
    <div className="text-sm text-ink-muted">
      Renew your plan to make changes.{' '}
      <Link to="/owner/plan" className="font-medium text-primary underline underline-offset-2">
        Go to plan
      </Link>
    </div>
  )
}

export default function Seats() {
  const now = useNow()
  const today = todayIST(now)
  const { library, canWrite } = useOwnerLibrary()
  const libraryId = library!.id

  const seatsQ = useAsync(() => services.listSeats(libraryId), [libraryId])
  const membersQ = useAsync(() => services.listMembers(libraryId), [libraryId])

  const members = useMemo(() => membersQ.data ?? [], [membersQ.data])
  const seats = useMemo(() => seatsQ.data ?? [], [seatsQ.data])

  const cells = useMemo(() => buildSeatCells(seats, members, today), [seats, members, today])

  const activeMembers = useMemo(() => members.filter((m) => m.status === 'active'), [members])
  const memberBySeat = useMemo(() => {
    const map = new Map<string, Member>()
    for (const m of activeMembers) if (m.seatId) map.set(m.seatId, m)
    return map
  }, [activeMembers])

  // Active students with no seat, for the "assign" select.
  const studentsWithoutSeat = useMemo(
    () => activeMembers.filter((m) => !m.seatId),
    [activeMembers],
  )
  const freeSeats = useMemo(
    () =>
      cells
        .filter((c) => c.state === 'free')
        .map((c) => ({ id: c.id, seatNumber: c.number })),
    [cells],
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedCell = cells.find((c) => c.id === selectedId) ?? null
  const selectedMember = selectedId ? memberBySeat.get(selectedId) ?? null : null

  const [addOpen, setAddOpen] = useState(false)
  const [addPresetSeatId, setAddPresetSeatId] = useState<string | null>(null)
  const [renewMember, setRenewMember] = useState<Member | null>(null)
  const [removeMember, setRemoveMember] = useState<Member | null>(null)

  const assign = useMutation(services.assignSeat, { success: 'Seat assigned' })
  const free = useMutation(services.assignSeat, { success: 'Seat freed' })
  const remove = useMutation(services.removeMember, { success: 'Student removed' })

  const [assignTo, setAssignTo] = useState('')

  const closeModal = () => {
    setSelectedId(null)
    setAssignTo('')
  }

  const loading = seatsQ.loading || membersQ.loading
  const error = seatsQ.error ?? membersQ.error

  return (
    <>
      <PageHeader title="Seats" description="Tap a seat to assign, renew or free it." />

      {!canWrite && (
        <div className="mb-4">
          <ReadOnlyNotice />
        </div>
      )}

      {loading ? (
        <LoadingState label="Loading seats" />
      ) : error ? (
        <ErrorState onRetry={() => { seatsQ.reload(); membersQ.reload() }} />
      ) : seats.length === 0 ? (
        <EmptyState
          title="No seats yet"
          description="Set a capacity below to create your seats."
        />
      ) : (
        <Card className="p-4 sm:p-6">
          <SeatGrid
            seats={cells}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
            showLegend
          />
        </Card>
      )}

      <SeatSettings libraryId={libraryId} seatCount={library!.capacity} canWrite={canWrite} />

      {/* Seat detail modal */}
      <Modal
        open={!!selectedCell}
        onClose={closeModal}
        title={selectedCell ? `Seat ${selectedCell.number}` : 'Seat'}
      >
        {selectedCell && selectedCell.state === 'disabled' && (
          <p className="text-sm text-ink-muted">
            This seat is not in use. Raise your capacity in the seats settings to bring it back.
          </p>
        )}

        {selectedCell && selectedCell.state === 'free' && (
          <div className="space-y-4">
            {!canWrite ? (
              <ReadOnlyNotice />
            ) : (
              <>
                <div>
                  <label htmlFor="assign-seat" className="mb-1.5 block text-sm font-medium">
                    Assign to a student
                  </label>
                  {studentsWithoutSeat.length === 0 ? (
                    <p className="text-sm text-ink-muted">
                      Every active student already has a seat. Add a new student below.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <select
                        id="assign-seat"
                        value={assignTo}
                        onChange={(e) => setAssignTo(e.target.value)}
                        className="block min-h-11 w-full cursor-pointer rounded-control border border-border-strong bg-surface px-3 py-2 text-base text-ink"
                      >
                        <option value="">Choose a student</option>
                        {studentsWithoutSeat.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        loading={assign.loading}
                        disabled={!assignTo}
                        onClick={async () => {
                          const ok = await assign.run(assignTo, selectedCell.id)
                          if (ok !== undefined) closeModal()
                        }}
                      >
                        Assign seat {selectedCell.number}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="border-t border-border pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAddPresetSeatId(selectedCell.id)
                      setSelectedId(null)
                      setAssignTo('')
                      setAddOpen(true)
                    }}
                  >
                    Add a new student to this seat
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {selectedCell && selectedMember && selectedCell.state !== 'free' && selectedCell.state !== 'disabled' && (
          <div className="space-y-4">
            <div>
              <p className="text-lg font-semibold">{selectedMember.name}</p>
              <a
                href={`tel:${selectedMember.phone}`}
                className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary underline underline-offset-2"
              >
                <Phone aria-hidden className="size-4" />
                {selectedMember.phone}
              </a>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-ink-muted">Started</dt>
                <dd className="tabular-nums">{formatDate(selectedMember.startDate)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Expires</dt>
                <dd className="tabular-nums">{formatDate(selectedMember.expiryDate)}</dd>
              </div>
            </dl>
            <ExpiryBadge member={selectedMember} today={today} />

            {!canWrite ? (
              <ReadOnlyNotice />
            ) : (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  onClick={() => {
                    setRenewMember(selectedMember)
                    setSelectedId(null)
                  }}
                >
                  Renew
                </Button>
                <Button
                  variant="secondary"
                  loading={free.loading}
                  onClick={async () => {
                    const ok = await free.run(selectedMember.id, null)
                    if (ok !== undefined) closeModal()
                  }}
                >
                  Free this seat
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setRemoveMember(selectedMember)
                    setSelectedId(null)
                  }}
                >
                  Remove student
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Shared modals */}
      <AddStudentModal
        open={addOpen}
        onClose={() => {
          setAddOpen(false)
          setAddPresetSeatId(null)
        }}
        libraryId={libraryId}
        monthlyFeePaise={library!.monthlyFeePaise}
        freeSeats={freeSeats}
        presetSeatId={addPresetSeatId}
        today={today}
      />

      <RenewModal
        open={!!renewMember}
        onClose={() => setRenewMember(null)}
        member={renewMember}
        monthlyFeePaise={library!.monthlyFeePaise}
        today={today}
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
          if (ok !== undefined) {
            setRemoveMember(null)
          }
        }}
      />
    </>
  )
}

function SeatSettings({
  libraryId,
  seatCount,
  canWrite,
}: {
  libraryId: string
  seatCount: number
  canWrite: boolean
}) {
  const [value, setValue] = useState(String(seatCount))
  const update = useMutation((n: number) => services.setCapacity(libraryId, n), {
    success: 'Seats updated',
    silent: true,
  })

  // Keep the input in sync when the seat count changes after a write.
  const [lastCount, setLastCount] = useState(seatCount)
  if (lastCount !== seatCount) {
    setLastCount(seatCount)
    setValue(String(seatCount))
  }

  const n = Number(value)
  const invalid = !Number.isInteger(n) || n < 1 || n > 500

  return (
    <Card className="mt-6 p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Seats</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Raising the number adds seats. Lowering it removes free seats only.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextField
          label="Capacity"
          type="number"
          min={1}
          max={500}
          inputMode="numeric"
          value={value}
          disabled={!canWrite}
          onChange={(e) => setValue(e.target.value)}
          className="sm:w-40"
        />
        <Button
          disabled={!canWrite || invalid || n === seatCount}
          loading={update.loading}
          onClick={() => void update.run(n)}
        >
          Update seats
        </Button>
      </div>
      {update.error && <p className="mt-2 text-sm font-medium text-danger">{update.error.message}</p>}
      {!canWrite && (
        <p className="mt-2">
          <ReadOnlyNotice />
        </p>
      )}
    </Card>
  )
}
