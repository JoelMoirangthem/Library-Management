import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import { CircleCheck, Hourglass, Lock, TriangleAlert } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageHeader } from '@/components/PageParts'
import { SuccessMoment } from '@/components/Steps'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { LibraryEditor } from '@/components/owner/profile/LibraryEditor'
import { OnboardingWizard } from '@/components/owner/profile/OnboardingWizard'
import type { ApprovalStatus, LibraryInput, ShiftInput } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { useTitle } from '@/hooks/useTitle'
import { services } from '@/lib/container'

const STATUS_META: Record<ApprovalStatus, { tone: BadgeTone; label: string; icon: ReactNode }> = {
  pending: { tone: 'warning', label: 'In review', icon: <Hourglass /> },
  approved: { tone: 'success', label: 'Live', icon: <CircleCheck /> },
  rejected: { tone: 'danger', label: 'Needs changes', icon: <TriangleAlert /> },
}

export default function LibraryProfile() {
  const { library, state, canEditProfile, loading, error, reload } = useOwnerLibrary()
  const [cityId, setCityId] = useState<string | null>(null)
  const [created, setCreated] = useState(false)

  const cities = useAsync(() => services.listCities(), [])
  const effectiveCityId = cityId ?? library?.cityId ?? null
  const areas = useAsync(
    () => (effectiveCityId ? services.listAreas({ cityId: effectiveCityId }) : Promise.resolve([])),
    [effectiveCityId],
  )
  const shiftsQ = useAsync(
    () => (library ? services.listShifts(library.id) : Promise.resolve([])),
    [library?.id],
  )

  const isNone = state === 'none'
  const isRejected = state === 'rejected'
  useTitle(isNone ? 'List your library' : 'Your library')

  const createLib = useMutation(
    (input: LibraryInput, shifts: ShiftInput[]) => services.createLibrary(input, shifts),
    { silent: true, onSuccess: () => setCreated(true) },
  )

  const save = useMutation(
    async (input: LibraryInput, changed: { id: string; input: ShiftInput }[], added: ShiftInput[]) => {
      await services.updateLibrary(library!.id, input)
      for (const c of changed) await services.updateShift(c.id, c.input)
      for (const a of added) await services.addShift(library!.id, a)
      if (isRejected) await services.resubmitLibrary(library!.id)
      shiftsQ.reload()
    },
    { success: isRejected ? 'Sent for review' : 'Changes saved' },
  )

  const toggle = useMutation(
    (shiftId: string, on: boolean) => services.setShiftActive(shiftId, on),
    { silent: true, onSuccess: () => shiftsQ.reload() },
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

  // Success view after a first-time create.
  if (created) {
    return (
      <>
        <PageHeader title="List your library" />
        <Card className="mx-auto max-w-lg p-2 sm:p-4">
          <SuccessMoment
            title="Submitted for review"
            actions={
              <Link to="/owner" className={buttonStyles('primary')}>
                Go to dashboard
              </Link>
            }
          >
            <ul className="mx-auto mt-2 max-w-sm space-y-2 text-left text-ink">
              <li className="flex gap-2">
                <span aria-hidden className="text-primary">1.</span>
                We review it, usually within 24 hours.
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-primary">2.</span>
                Your 14-day free trial starts when we approve.
              </li>
              <li className="flex gap-2">
                <span aria-hidden className="text-primary">3.</span>
                Students can then find you.
              </li>
            </ul>
          </SuccessMoment>
        </Card>
      </>
    )
  }

  // First-time onboarding wizard.
  if (isNone) {
    return (
      <>
        <PageHeader
          title="List your library"
          description="Tell students about your library. We review every listing, usually within 24 hours."
        />
        <div className="mx-auto max-w-2xl">
          <OnboardingWizard
            cities={cities.data ?? []}
            areas={areas.data ?? []}
            onCityChange={setCityId}
            onSubmit={(input, shifts) => void createLib.run(input, shifts)}
            submitting={createLib.loading}
            error={createLib.error?.message}
          />
        </div>
      </>
    )
  }

  // Edit mode.
  const meta = library ? STATUS_META[library.approvalStatus] : null

  return (
    <>
      <PageHeader
        title="Your library"
        actions={meta ? <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge> : undefined}
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

      {canEditProfile && library ? (
        shiftsQ.loading ? (
          <LoadingState layout="list" count={4} label="Loading your library" />
        ) : shiftsQ.error ? (
          <ErrorState onRetry={shiftsQ.reload} />
        ) : (
          <LibraryEditor
            library={library}
            shifts={shiftsQ.data ?? []}
            cities={cities.data ?? []}
            areas={areas.data ?? []}
            catalogLoading={cities.loading}
            onCityChange={setCityId}
            onSave={async (input, changed, added) => (await save.run(input, changed, added)) !== undefined}
            onToggleShift={async (id, on) => (await toggle.run(id, on)) !== undefined}
            saving={save.loading}
            isRejected={isRejected}
          />
        )
      ) : (
        library && <ReadOnlyLibrary />
      )}
    </>
  )
}

function ReadOnlyLibrary() {
  return (
    <Card className="p-5 text-sm text-ink-muted sm:p-6">
      Renew your plan to edit your library details again.
    </Card>
  )
}
