import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Ban, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Button, buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
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

const STATUS: Record<RequestStatus, { tone: BadgeTone; label: string; icon: React.ReactNode }> = {
  pending: { tone: 'warning', label: 'Pending', icon: <Clock /> },
  approved: { tone: 'success', label: 'Approved', icon: <CheckCircle2 /> },
  rejected: { tone: 'danger', label: 'Rejected', icon: <XCircle /> },
  cancelled: { tone: 'neutral', label: 'Cancelled', icon: <Ban /> },
}

export default function MyRequests() {
  const requests = useAsync(() => services.listMySeatRequests(), [])
  const [toCancel, setToCancel] = useState<MySeatRequest | null>(null)

  const cancelRequest = useMutation((id: string) => services.cancelSeatRequest(id), {
    success: 'Request cancelled',
    onSuccess: () => setToCancel(null),
  })

  // Newest first.
  const sorted = requests.data
    ? [...requests.data].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
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
        <ul className="space-y-3">
          {sorted.map((r) => {
            const s = STATUS[r.status]
            return (
              <li key={r.id}>
                <Card className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold leading-tight">
                        <Link to={`/library/${r.libraryId}`} className="hover:underline">
                          {r.libraryName}
                        </Link>
                      </h2>
                      <p className="mt-0.5 text-sm text-ink-muted">
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

                  <div className="mt-4 flex flex-wrap gap-2">
                    {r.status === 'pending' && (
                      <Button variant="secondary" onClick={() => setToCancel(r)}>
                        Cancel request
                      </Button>
                    )}
                    {r.status === 'approved' && (
                      <Link to="/student/membership" className={buttonStyles('primary')}>
                        View membership
                      </Link>
                    )}
                    <Link to={`/library/${r.libraryId}`} className={buttonStyles('ghost')}>
                      View library
                    </Link>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
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
