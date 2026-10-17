import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Button, buttonStyles } from '@/components/Button'
import { CardBody, CardFooter, CardGrid, GridCard, GridItem } from '@/components/CardGrid'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/PageParts'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { formatDateTime } from '@/domain/dates'
import type { MySeatRequest, RequestStatus } from '@/domain/types'
import { services } from '@/lib/container'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useTitle } from '@/hooks/useTitle'
import { cx } from '@/lib/cx'

const STATUS: Record<RequestStatus, { tone: BadgeTone; label: string; icon: React.ReactNode }> = {
  pending: { tone: 'warning', label: 'Pending', icon: <Clock /> },
  approved: { tone: 'success', label: 'Approved', icon: <CheckCircle2 /> },
  rejected: { tone: 'danger', label: 'Not available', icon: <XCircle /> },
  cancelled: { tone: 'neutral', label: 'Cancelled', icon: <Ban /> },
}

/** Two-step progress: Sent, then Decision. Pending still waits on the decision. */
function ProgressLine({ status }: { status: RequestStatus }) {
  const decided = status !== 'pending'
  const decisionLabel =
    status === 'approved' ? 'Approved' : status === 'rejected' ? 'Decided' : status === 'cancelled' ? 'Cancelled' : 'Decision'
  return (
    <ol className="flex items-center gap-2 text-xs font-medium text-ink-muted" aria-label="Request progress">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-full bg-primary" />
        Sent
      </li>
      <li aria-hidden className={cx('h-px w-6', decided ? 'bg-primary' : 'bg-border')} />
      <li className={cx('flex items-center gap-1.5', decided && 'text-ink')}>
        <span
          aria-hidden
          className={cx('size-2.5 rounded-full', decided ? 'bg-primary' : 'border border-border-strong bg-surface')}
        />
        {decisionLabel}
      </li>
    </ol>
  )
}

function RequestCard({
  r,
  cityId,
  onCancel,
}: {
  r: MySeatRequest
  /** Resolved from the city name so the declined action can pre-select it in Discover. */
  cityId?: string
  onCancel: (r: MySeatRequest) => void
}) {
  const s = STATUS[r.status]
  // The footer action differs by status; render a placeholder so footers stay the same height.
  const action =
    r.status === 'pending' ? (
      <Button variant="secondary" onClick={() => onCancel(r)}>
        Cancel request
      </Button>
    ) : r.status === 'approved' ? (
      <Link to="/student/membership" className={buttonStyles('primary')}>
        View my membership
      </Link>
    ) : r.status === 'rejected' ? (
      <Link
        to={cityId ? `/discover?city=${cityId}` : '/discover'}
        className={buttonStyles('secondary')}
      >
        Find another library
      </Link>
    ) : (
      <span className="text-sm text-ink-muted">No action needed</span>
    )

  return (
    <GridCard>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold leading-tight">
              <Link
                to={`/library/${r.libraryId}`}
                className="inline-flex min-h-11 items-center break-words hover:underline"
              >
                {r.libraryName}
              </Link>
            </h3>
            <p className="mt-0.5 break-words text-sm text-ink-muted">
              {r.shiftName} · {r.areaName}, {r.cityName}
            </p>
            <p className="mt-2 text-sm text-ink-muted tabular-nums">
              Requested {formatDateTime(r.createdAt)}
            </p>
          </div>
          <Badge tone={s.tone} icon={s.icon}>
            {s.label}
          </Badge>
        </div>

        <div className="mt-auto">
          <ProgressLine status={r.status} />
        </div>
      </CardBody>

      <CardFooter>{action}</CardFooter>
    </GridCard>
  )
}

export default function MyRequests() {
  useTitle('My requests')
  const requests = useAsync(() => services.listMySeatRequests(), [])
  const cities = useAsync(() => services.listCities(), [])
  const [toCancel, setToCancel] = useState<MySeatRequest | null>(null)

  // Map city name -> id so a declined request can pre-select its city in Discover.
  const cityIdByName = new Map((cities.data ?? []).map((c) => [c.name, c.id] as const))

  const cancelRequest = useMutation((id: string) => services.cancelSeatRequest(id), {
    success: 'Request cancelled',
    onSuccess: () => {
      setToCancel(null)
      void requests.reload()
    },
  })

  // Newest first, then split into waiting (pending) and decided (everything else).
  const sorted = requests.data
    ? [...requests.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []
  const waiting = sorted.filter((r) => r.status === 'pending')
  const decided = sorted.filter((r) => r.status !== 'pending')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="My requests"
        description="Seats you've asked for. Owners reply from their side."
      />

      {requests.loading ? (
        <LoadingState layout="list" label="Loading your requests" />
      ) : requests.error ? (
        <ErrorState onRetry={requests.reload} retrying={requests.refreshing} />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No requests yet"
          description="Find a library with a free seat and send your first request."
          action={
            <Link to="/discover" className={buttonStyles('primary')}>
              Find a library
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {waiting.length > 0 && (
            <section aria-labelledby="waiting-heading">
              <h2 id="waiting-heading" className="mb-3 text-lg font-semibold">
                Waiting
              </h2>
              <CardGrid count={waiting.length} max={2}>
                {waiting.map((r) => (
                  <GridItem key={r.id}>
                    <RequestCard r={r} cityId={cityIdByName.get(r.cityName)} onCancel={setToCancel} />
                  </GridItem>
                ))}
              </CardGrid>
            </section>
          )}

          {decided.length > 0 && (
            <section aria-labelledby="decided-heading">
              <h2 id="decided-heading" className="mb-3 text-lg font-semibold">
                Decided
              </h2>
              <CardGrid count={decided.length} max={2}>
                {decided.map((r) => (
                  <GridItem key={r.id}>
                    <RequestCard r={r} cityId={cityIdByName.get(r.cityName)} onCancel={setToCancel} />
                  </GridItem>
                ))}
              </CardGrid>
            </section>
          )}
        </div>
      )}

      <Modal
        open={toCancel !== null}
        onClose={() => setToCancel(null)}
        title="Cancel this request?"
        description={
          toCancel
            ? `Your pending request at ${toCancel.libraryName} will be withdrawn. You can request again later.`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setToCancel(null)}>
              Keep request
            </Button>
            <Button
              variant="danger"
              loading={cancelRequest.loading}
              onClick={() => toCancel && void cancelRequest.run(toCancel.id)}
            >
              Cancel request
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">This can&rsquo;t be undone.</p>
      </Modal>
    </div>
  )
}
