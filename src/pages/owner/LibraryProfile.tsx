import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Hourglass, Lock } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageHeader } from '@/components/PageParts'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { LibraryForm } from '@/components/owner/profile/LibraryForm'
import type { ApprovalStatus, LibraryInput, ShiftInput } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { services } from '@/lib/container'

const STATUS_META: Record<ApprovalStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: 'warning', label: 'In review' },
  approved: { tone: 'success', label: 'Live' },
  rejected: { tone: 'danger', label: 'Needs changes' },
}

export default function LibraryProfile() {
  const { library, state, canEditProfile, loading, error, reload } = useOwnerLibrary()
  const [cityId, setCityId] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  const cities = useAsync(() => services.listCities(), [])
  // Area list depends on the chosen city (default to the saved one on first load).
  const effectiveCityId = cityId ?? library?.cityId ?? null
  const areas = useAsync(
    () => (effectiveCityId ? services.listAreas({ cityId: effectiveCityId }) : Promise.resolve([])),
    [effectiveCityId],
  )

  const createLib = useMutation(
    (input: LibraryInput, shifts: ShiftInput[]) => services.createLibrary(input, shifts),
    {
      silent: true,
      onSuccess: () => setCreated(true),
    },
  )
  const updateLib = useMutation(
    (input: LibraryInput) => services.updateLibrary(library!.id, input),
    { success: 'Changes saved' },
  )
  const saveAndResubmit = useMutation(
    async (input: LibraryInput) => {
      await services.updateLibrary(library!.id, input)
      await services.resubmitLibrary(library!.id)
    },
    { success: 'Sent for review' },
  )

  if (loading) {
    return (
      <>
        <PageHeader title="Your library" />
        <LoadingState layout="list" count={3} label="Loading your library" />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Your library" />
        <ErrorState onRetry={reload} />
      </>
    )
  }

  const isNone = state === 'none'
  const isRejected = state === 'rejected'

  // Success view after a first-time create.
  if (created) {
    return (
      <>
        <PageHeader title="Your library" />
        <Card className="mx-auto max-w-md p-6 text-center sm:p-8">
          <span
            aria-hidden
            className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-success-soft text-success-ink"
          >
            <CheckCircle2 className="size-7" />
          </span>
          <h2 className="text-xl font-semibold">Submitted for review</h2>
          <p className="mx-auto mt-2 max-w-prose text-ink-muted">
            In review, usually within 24 hours. Your 14-day free trial starts the moment we
            approve your library.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/owner" className={buttonStyles('primary')}>
              Go to dashboard
            </Link>
          </div>
        </Card>
      </>
    )
  }

  const title = isNone ? 'List your library' : 'Your library'
  const submitLabel = isNone
    ? 'Submit for review'
    : isRejected
      ? 'Save and resubmit'
      : 'Save changes'

  function handleSubmit(input: LibraryInput, shifts?: ShiftInput[]) {
    if (isNone) void createLib.run(input, shifts ?? [])
    else if (isRejected) void saveAndResubmit.run(input)
    else void updateLib.run(input)
  }

  const submitting = createLib.loading || updateLib.loading || saveAndResubmit.loading

  return (
    <>
      <PageHeader
        title={title}
        description={
          isNone
            ? 'Tell students about your library. We review every listing, usually within 24 hours.'
            : undefined
        }
        actions={
          library ? (
            <Badge tone={STATUS_META[library.approvalStatus].tone} icon={<Hourglass />}>
              {STATUS_META[library.approvalStatus].label}
            </Badge>
          ) : undefined
        }
      />

      {isRejected && library?.rejectionReason && (
        <Card className="mb-6 border-danger/30 bg-danger-soft p-4 text-danger-ink sm:p-5">
          <p className="text-sm font-semibold">This listing needs changes before it can go live</p>
          <p className="mt-1 text-sm">{library.rejectionReason}</p>
          <p className="mt-2 text-sm">Fix the points above, then save to send it back for review.</p>
        </Card>
      )}

      {!canEditProfile && (
        <Card className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-warning/30 bg-warning-soft p-4 text-warning-ink">
          <span aria-hidden className="[&>svg]:size-5">
            <Lock />
          </span>
          <p className="min-w-0 flex-1 text-sm font-medium">
            Your plan has expired, so this page is read-only. Renew to edit your library again.
          </p>
          <Link to="/owner/plan" className={buttonStyles('accent')}>
            Renew plan
          </Link>
        </Card>
      )}

      {createLib.error && (
        <Card className="mb-6 border-danger/30 bg-danger-soft p-4 text-sm font-medium text-danger-ink" role="alert">
          {createLib.error.message}
        </Card>
      )}

      <Card className="p-5 sm:p-6">
        <LibraryForm
          library={library}
          cities={cities.data ?? []}
          areas={areas.data ?? []}
          onCityChange={setCityId}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={submitLabel}
          disabled={!canEditProfile}
          isExisting={!isNone}
        />
      </Card>
    </>
  )
}
