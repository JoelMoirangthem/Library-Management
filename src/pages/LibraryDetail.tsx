import { Link, useLocation, useParams } from 'react-router-dom'
import {
  Armchair,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Timer,
} from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button, buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { SeatMark } from '@/components/Logo'
import { PageHeader } from '@/components/PageParts'
import { SeatStrip } from '@/components/SeatGrid'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { NotFoundState } from '@/components/states/NotFoundState'
import { mapsLink } from '@/domain/constants'
import { formatRupees } from '@/domain/money'
import type { PublicLibrary } from '@/domain/types'
import { services } from '@/lib/container'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useAuth } from '@/hooks/useAuth'

function PhotoGallery({ library }: { library: PublicLibrary }) {
  if (library.photos.length === 0) {
    return (
      <div
        aria-hidden
        className="flex h-56 items-center justify-center rounded-card bg-primary-soft text-primary sm:h-72"
      >
        <SeatMark className="size-16 opacity-80" />
      </div>
    )
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <img
        src={library.photos[0]}
        alt={`${library.name} photo 1`}
        className="h-56 w-full rounded-card object-cover sm:h-72 sm:col-span-2"
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

/** The seat-request action, which differs by who is viewing. */
function RequestAction({
  library,
  pendingRequestId,
  isMemberHere,
  requestsReady,
  membershipsReady,
}: {
  library: PublicLibrary
  pendingRequestId: string | null
  isMemberHere: boolean
  requestsReady: boolean
  membershipsReady: boolean
}) {
  const { user } = useAuth()
  const location = useLocation()

  const requestSeat = useMutation(() => services.requestSeat(library.id), {
    success: 'Request sent',
  })
  const cancelRequest = useMutation((id: string) => services.cancelSeatRequest(id), {
    success: 'Request cancelled',
  })

  const full = library.seatsLeft === 0

  // Signed out.
  if (!user) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-muted">Log in to request a seat at this library.</p>
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
      <p className="text-sm text-ink-muted">
        Only students can request a seat. Sign in with a student account to request one.
      </p>
    )
  }

  // Wait until we know the student's existing state before offering an action.
  if (!requestsReady || !membershipsReady) {
    return <LoadingState label="Checking your requests" count={1} />
  }

  // Already a member here.
  if (isMemberHere) {
    return (
      <div className="space-y-3">
        <Badge tone="success" icon={<CheckCircle2 />}>
          You&rsquo;re a member
        </Badge>
        <Link to="/student/membership" className={buttonStyles('secondary', 'w-full')}>
          View membership
        </Link>
      </div>
    )
  }

  // Pending request here.
  if (pendingRequestId) {
    return (
      <div className="space-y-3">
        <Badge tone="warning" icon={<Clock />}>
          Request sent
        </Badge>
        <p className="text-sm text-ink-muted">
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

  // No request yet.
  return (
    <div className="space-y-3">
      {full && (
        <p className="text-sm text-ink-muted">
          All seats are taken right now. You can still request one &mdash; the owner will reply
          when a seat opens.
        </p>
      )}
      <Button
        variant="primary"
        className="w-full"
        loading={requestSeat.loading}
        onClick={() => void requestSeat.run()}
      >
        Request a seat
      </Button>
    </div>
  )
}

export default function LibraryDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const isStudent = user?.role === 'student'

  const library = useAsync(() => services.getPublicLibrary(id), [id])

  // Only students need their request/membership status; owners and signed-out users don't.
  const myRequests = useAsync(
    () => (isStudent ? services.listMySeatRequests() : Promise.resolve([])),
    [isStudent],
  )
  const myMemberships = useAsync(
    () => (isStudent ? services.listMyMemberships() : Promise.resolve([])),
    [isStudent],
  )

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
          title="This library isn't listed right now"
          description="It may have paused its plan. Browse other libraries instead."
          action={
            <Link to="/discover" className={buttonStyles('primary')}>
              Back to Find a library
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

  const pendingRequestId =
    myRequests.data?.find((r) => r.libraryId === lib.id && r.status === 'pending')?.id ?? null
  const isMemberHere = Boolean(
    myMemberships.data?.some((m) => m.library?.id === lib.id && m.member.status === 'active'),
  )

  const actionProps = {
    library: lib,
    pendingRequestId,
    isMemberHere,
    requestsReady,
    membershipsReady,
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-6 lg:pb-8">
      <div className="mb-4">
        <Link to="/discover" className="text-sm font-medium text-primary hover:underline">
          &larr; Find a library
        </Link>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <PhotoGallery library={lib} />

          <div>
            <PageHeader title={lib.name} />
            <p className="-mt-4 flex items-center gap-1.5 text-ink-muted">
              <MapPin aria-hidden className="size-4 shrink-0" />
              {lib.areaName}, {lib.cityName}
            </p>
          </div>

          <Card className="p-4 sm:p-5">
            <h2 className="mb-2 text-lg font-semibold">Seats</h2>
            <p className="text-2xl font-semibold tabular-nums">
              {lib.seatsLeft} of {lib.totalSeats} seats free
            </p>
            <SeatStrip total={lib.totalSeats} free={lib.seatsLeft} className="mt-3" />
          </Card>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-card border border-border bg-surface p-4">
              <dt className="text-sm text-ink-muted">Monthly fee</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">
                {formatRupees(lib.monthlyFeePaise)}
                <span className="text-sm font-normal text-ink-muted"> / month</span>
              </dd>
            </div>
            <div className="rounded-card border border-border bg-surface p-4">
              <dt className="flex items-center gap-1.5 text-sm text-ink-muted">
                <Timer aria-hidden className="size-4" /> Timings
              </dt>
              <dd className="mt-1 text-lg font-semibold">{lib.timings}</dd>
            </div>
          </dl>

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
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonStyles('secondary', 'mt-3')}
            >
              <MapPin aria-hidden className="size-4" />
              Open in Google Maps
            </a>
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
            <div className="flex items-center gap-2 text-primary">
              <Armchair aria-hidden className="size-5" />
              <span className="font-semibold">Request a seat</span>
            </div>
            <RequestAction {...actionProps} />
            <a href={`tel:${lib.phone}`} className={buttonStyles('secondary', 'w-full')}>
              <Phone aria-hidden className="size-4" />
              Call
            </a>
          </Card>
        </aside>
      </div>

      {/* Sticky bottom action bar on phones/tablets. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface p-4 lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <a href={`tel:${lib.phone}`} className={buttonStyles('secondary', 'flex-1')}>
            <Phone aria-hidden className="size-4" />
            Call
          </a>
          <div className="flex-1">
            <RequestAction {...actionProps} />
          </div>
        </div>
      </div>
    </div>
  )
}
