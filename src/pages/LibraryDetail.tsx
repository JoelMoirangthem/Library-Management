import { useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { CheckCircle2, Clock, MapPin, Phone } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button, buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { LibraryArt } from '@/components/LibraryArt'
import { PageHeader } from '@/components/PageParts'
import { SeatStrip } from '@/components/SeatGrid'
import { SuccessMoment } from '@/components/Steps'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { NotFoundState } from '@/components/states/NotFoundState'
import { formatPhone, isValidPhone, mapsLink } from '@/domain/constants'
import { formatRupees } from '@/domain/money'
import { formatShiftRange } from '@/domain/shifts'
import type { PublicLibrary, PublicShift } from '@/domain/types'
import { services } from '@/lib/container'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { cx } from '@/lib/cx'

function Cover({ library }: { library: PublicLibrary }) {
  if (library.photos.length === 0) {
    return <LibraryArt shifts={library.shifts} className="h-56 rounded-card sm:h-72" />
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <img
        src={library.photos[0]}
        alt={`${library.name} photo 1`}
        className="h-56 w-full rounded-card object-cover sm:col-span-2 sm:h-72"
      />
      {library.photos.slice(1, 3).map((src, i) => (
        <img
          key={src}
          src={src}
          alt={`${library.name} photo ${i + 2}`}
          className="h-32 w-full rounded-card object-cover"
        />
      ))}
    </div>
  )
}

/** The seat-request action for the SELECTED shift, which differs by who is viewing. */
function RequestAction({
  library,
  shift,
  pendingRequestId,
  isMemberHere,
  requestsReady,
  membershipsReady,
  justSent,
  onSent,
  onReset,
  onCancelled,
}: {
  library: PublicLibrary
  shift: PublicShift
  pendingRequestId: string | null
  isMemberHere: boolean
  requestsReady: boolean
  membershipsReady: boolean
  justSent: boolean
  onSent: () => void
  onReset: () => void
  onCancelled: () => void
}) {
  const { user } = useAuth()
  const location = useLocation()

  const requestSeat = useMutation(() => services.requestSeat(library.id, shift.id), {
    success: 'Request sent',
    onSuccess: onSent,
  })
  const cancelRequest = useMutation((id: string) => services.cancelSeatRequest(id), {
    success: 'Request cancelled',
    onSuccess: onCancelled,
  })

  const full = shift.seatsLeft === 0

  // Signed out.
  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-ink-muted">Log in to request a seat at this library.</p>
        <Link
          to="/login"
          state={{ from: location.pathname + location.search }}
          className={buttonStyles('primary', 'w-full')}
        >
          Log in to request a seat
        </Link>
      </div>
    )
  }

  // Owner or admin.
  if (user.role !== 'student') {
    return (
      <p className="text-ink-muted">
        Only students can request a seat. Sign in with a student account to request one.
      </p>
    )
  }

  // Wait until we know the student's existing state before offering an action.
  if (!requestsReady || !membershipsReady) {
    return <LoadingState label="Checking your requests" count={1} />
  }

  // Already a member of this shift.
  if (isMemberHere) {
    return (
      <div className="space-y-3">
        <Badge tone="success" icon={<CheckCircle2 />}>
          You&rsquo;re in this shift
        </Badge>
        <Link to="/student/membership" className={buttonStyles('secondary', 'w-full')}>
          View my membership
        </Link>
      </div>
    )
  }

  // Just sent: the celebratory confirmation replaces the action.
  if (justSent) {
    return (
      <SuccessMoment
        title={`Request sent to ${library.name}`}
        className="py-6"
        actions={
          <>
            <Link to="/student/requests" className={buttonStyles('primary')}>
              View my requests
            </Link>
            <button type="button" onClick={onReset} className={buttonStyles('secondary')}>
              Request another shift
            </button>
          </>
        }
      >
        They&rsquo;ll call you on {formatPhone(user.phone)}.
      </SuccessMoment>
    )
  }

  // Pending request for this shift.
  if (pendingRequestId) {
    return (
      <div className="space-y-3">
        <Badge tone="warning" icon={<Clock />}>
          Request sent
        </Badge>
        <p className="text-ink-muted">
          The owner will reply soon. You can cancel while it&rsquo;s still pending.
        </p>
        <Button
          variant="secondary"
          className="w-full"
          loading={cancelRequest.loading}
          onClick={() => void cancelRequest.run(pendingRequestId)}
        >
          Cancel request
        </Button>
      </div>
    )
  }

  // Student without a valid phone: block the request, point to the profile.
  if (!isValidPhone(user.phone)) {
    return (
      <div className="space-y-3">
        <p className="text-ink-muted">
          Add your phone number so the owner can call you back about this seat.
        </p>
        <Link to="/profile" className={buttonStyles('primary', 'w-full')}>
          Add your phone number
        </Link>
      </div>
    )
  }

  // No request yet for this shift.
  return (
    <div className="space-y-3">
      {full && (
        <p className="text-ink-muted">
          {shift.name} is full right now. You can still request a seat &mdash; the owner will reply
          when a seat opens.
        </p>
      )}
      <Button
        variant="primary"
        className="w-full"
        loading={requestSeat.loading}
        onClick={() => void requestSeat.run()}
      >
        Request a seat in {shift.name}
      </Button>
    </div>
  )
}

/** Selectable radio-styled card for one shift. */
function ShiftOption({
  shift,
  selected,
  onSelect,
}: {
  shift: PublicShift
  selected: boolean
  onSelect: () => void
}) {
  const full = shift.seatsLeft === 0
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        'flex w-full flex-col gap-2 rounded-card border p-4 text-left transition-colors',
        selected
          ? 'border-primary bg-primary-soft'
          : 'border-border-strong bg-surface hover:bg-canvas',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words font-semibold leading-tight">{shift.name}</p>
          <p className="flex items-center gap-1 text-sm tabular-nums text-ink-muted">
            <Clock aria-hidden className="size-3.5" />
            {formatShiftRange(shift)}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums">
          {formatRupees(shift.monthlyFeePaise)}
          <span className="font-normal text-ink-muted"> / month</span>
        </p>
      </div>
      <p className="text-sm font-medium tabular-nums">
        {full ? 'Full' : `${shift.seatsLeft} of ${shift.totalSeats} seats free`}
      </p>
      <SeatStrip total={shift.totalSeats} free={shift.seatsLeft} />
    </button>
  )
}

export default function LibraryDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const isStudent = user?.role === 'student'

  const library = useAsync(() => services.getPublicLibrary(id), [id])
  useTitle(library.data?.name ?? 'Library')

  // Only students need their request/membership status; owners and signed-out users don't.
  const myRequests = useAsync(
    () => (isStudent ? services.listMySeatRequests() : Promise.resolve([])),
    [isStudent],
  )
  const myMemberships = useAsync(
    () => (isStudent ? services.listMyMemberships() : Promise.resolve([])),
    [isStudent],
  )

  const shifts = useMemo(() => library.data?.shifts ?? [], [library.data])

  // Default the selected shift to the first shift with a free seat, else the first shift.
  const defaultShiftId = useMemo(() => {
    const firstFree = shifts.find((s) => s.seatsLeft > 0)
    return (firstFree ?? shifts[0])?.id ?? ''
  }, [shifts])

  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null)
  // Which shift (if any) was just requested, so we show the confirmation for it.
  const [sentShiftId, setSentShiftId] = useState<string | null>(null)

  const selectedShift =
    shifts.find((s) => s.id === (selectedShiftId ?? defaultShiftId)) ?? shifts[0] ?? null

  if (library.loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <LoadingState layout="cards" count={2} label="Loading library" />
      </div>
    )
  }

  if (library.error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ErrorState onRetry={library.reload} retrying={library.refreshing} />
      </div>
    )
  }

  if (!library.data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <NotFoundState
          heading="h1"
          title="This library isn't listed right now"
          description="It may have paused its plan. Browse other libraries instead."
          action={
            <Link to="/discover" className={buttonStyles('primary')}>
              Find a library
            </Link>
          }
        />
      </div>
    )
  }

  const lib = library.data
  const maps = mapsLink([lib.address, lib.landmark, lib.areaName, lib.cityName, lib.pincode])
  const requestsReady = !myRequests.loading
  const membershipsReady = !myMemberships.loading

  // Request/membership state is per shift.
  const pendingRequestId = selectedShift
    ? (myRequests.data?.find(
        (r) => r.libraryId === lib.id && r.shiftId === selectedShift.id && r.status === 'pending',
      )?.id ?? null)
    : null
  const isMemberHere = Boolean(
    selectedShift &&
      myMemberships.data?.some(
        (m) =>
          m.library?.id === lib.id &&
          m.member.shiftId === selectedShift.id &&
          m.member.status === 'active',
      ),
  )

  function selectShift(shiftId: string) {
    setSelectedShiftId(shiftId)
    // Leaving the confirmation when picking a different shift.
    setSentShiftId(null)
  }

  const actionCard = selectedShift ? (
    <RequestAction
      library={lib}
      shift={selectedShift}
      pendingRequestId={pendingRequestId}
      isMemberHere={isMemberHere}
      requestsReady={requestsReady}
      membershipsReady={membershipsReady}
      justSent={sentShiftId === selectedShift.id}
      onSent={() => {
        setSentShiftId(selectedShift.id)
        void myRequests.reload()
      }}
      onReset={() => setSentShiftId(null)}
      onCancelled={() => void myRequests.reload()}
    />
  ) : (
    <p className="text-ink-muted">This library has no shifts open right now.</p>
  )

  const selectedSummary = selectedShift
    ? `${selectedShift.name} · ${formatShiftRange(selectedShift)} · ${formatRupees(selectedShift.monthlyFeePaise)}/month`
    : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-56 sm:px-6 lg:pb-8">
      <div className="mb-4">
        <Link
          to="/discover"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline"
        >
          &larr; Find a library
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Cover library={lib} />

          <div>
            <PageHeader title={lib.name} />
            <p className="-mt-4 flex items-center gap-1.5 break-words text-ink-muted">
              <MapPin aria-hidden className="size-4 shrink-0" />
              {lib.areaName}, {lib.cityName}
            </p>
          </div>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-1 text-lg font-semibold">Shifts</h2>
            <p className="mb-3 text-sm text-ink-muted">
              Pick a shift to request a seat. Each shift has its own fee and seats.
            </p>
            {shifts.length > 0 ? (
              <div
                role="radiogroup"
                aria-label="Choose a shift"
                className="grid gap-3 sm:grid-cols-2"
              >
                {shifts.map((s) => (
                  <ShiftOption
                    key={s.id}
                    shift={s}
                    selected={selectedShift?.id === s.id}
                    onSelect={() => selectShift(s.id)}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No shifts are open right now.</p>
            )}
          </Card>

          <section>
            <h2 className="mb-2 text-lg font-semibold">Address</h2>
            <address className="not-italic text-ink">
              {lib.address}
              {lib.landmark && (
                <>
                  <br />
                  Landmark: {lib.landmark}
                </>
              )}
              <br />
              {lib.areaName}, {lib.cityName} <span className="tabular-nums">{lib.pincode}</span>
            </address>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href={maps}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonStyles('secondary')}
              >
                <MapPin aria-hidden className="size-4" />
                Open in Google Maps
              </a>
              <a href={`tel:${lib.phone}`} className={buttonStyles('secondary')}>
                <Phone aria-hidden className="size-4" />
                Call
              </a>
            </div>
          </section>

          {lib.amenities.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg font-semibold">Amenities</h2>
              <ul className="flex flex-wrap gap-2">
                {lib.amenities.map((a) => (
                  <li key={a} className="rounded-full bg-canvas px-3 py-1 text-sm text-ink">
                    {a}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Desktop sidebar action card. */}
        <aside className="hidden lg:block">
          <Card className="sticky top-20 space-y-4 p-5">
            <div>
              <p className="font-semibold">
                {selectedShift ? `Request a seat in ${selectedShift.name}` : 'Request a seat'}
              </p>
              {selectedSummary && (
                <p className="mt-0.5 text-sm tabular-nums text-ink-muted">{selectedSummary}</p>
              )}
            </div>
            {actionCard}
          </Card>
        </aside>
      </div>

      {/* Sticky bottom action bar on phones/tablets, above the safe area. */}
      <div
        className={`fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden ${
          user?.role === 'student' ? 'max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-md:pb-0' : ''
        }`}
      >
        <div className="mx-auto max-w-6xl space-y-2 p-4">
          {selectedSummary && (
            <p className="text-sm tabular-nums text-ink-muted">{selectedSummary}</p>
          )}
          {actionCard}
        </div>
      </div>
    </div>
  )
}
