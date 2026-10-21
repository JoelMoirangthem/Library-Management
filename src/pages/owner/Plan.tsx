import { Link } from 'react-router-dom'
import { CircleCheck, Hourglass, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageHeader } from '@/components/PageParts'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { SetupState } from '@/components/states/SetupState'
import { PaymentCard, UTR_INPUT_ID } from '@/components/owner/plan/PaymentCard'
import { PaymentHistory } from '@/components/owner/plan/PaymentHistory'
import { dateOfInstant, formatDate } from '@/domain/dates'
import { extendedActiveUntil } from '@/domain/plan'
import type { PlanPayment } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { useTitle } from '@/hooks/useTitle'
import { services } from '@/lib/container'
import { getUpiId } from '@/lib/env'
import { useNow } from '@/lib/devState'

function dayWord(n: number) {
  return `${n} day${n === 1 ? '' : 's'}`
}

function StatusCard({
  tone,
  icon,
  title,
  children,
}: {
  tone: 'primary' | 'warning' | 'danger'
  icon: ReactNode
  title: string
  children?: ReactNode
}) {
  const skin =
    tone === 'primary'
      ? 'border-primary/25 bg-primary-soft text-primary-ink'
      : tone === 'warning'
        ? 'border-warning/30 bg-warning-soft text-warning-ink'
        : 'border-danger/30 bg-danger-soft text-danger-ink'
  return (
    <Card className={`p-5 sm:p-6 ${skin}`}>
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-0.5 [&>svg]:size-6">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
          {children && <div className="mt-1 text-sm sm:text-base">{children}</div>}
        </div>
      </div>
    </Card>
  )
}

function focusUtrForm() {
  const el = document.getElementById(UTR_INPUT_ID)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el?.querySelector<HTMLInputElement>('input')?.focus()
}

/** Reads the UPI ID setting once per render. A bad or missing value becomes a message, not a crash. */
function readUpiSetting(): { upiId: string; error?: undefined } | { upiId?: undefined; error: string } {
  try {
    return { upiId: getUpiId() }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) }
  }
}

export default function Plan() {
  useTitle('Plan')
  const now = useNow()
  const { library, subscription, state, daysLeft, loading, error, reload } = useOwnerLibrary()

  const payments = useAsync(
    () => (library ? services.listMyPlanPayments(library.id) : Promise.resolve([])),
    [library?.id],
  )

  const submit = useMutation(
    (utr: string) => services.submitPlanPayment(library!.id, utr),
    { success: 'Payment submitted', onSuccess: () => payments.reload() },
  )

  if (loading) {
    return (
      <>
        <PageHeader title="Plan" />
        <LoadingState layout="list" count={3} label="Loading your plan" />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title="Plan" />
        <ErrorState onRetry={reload} />
      </>
    )
  }

  if (state === 'none' || !library) {
    return (
      <>
        <PageHeader title="Plan" />
        <SetupState
          title="List your library first"
          description="Once your library is approved, you can activate the ₹199 plan here."
          action={
            <Link to="/owner/library" className={buttonStyles('primary')}>
              List your library
            </Link>
          }
        />
      </>
    )
  }

  const upi = readUpiSetting()
  const activeUntilDate = subscription ? dateOfInstant(subscription.activeUntil) : null
  const canPay = state === 'trial' || state === 'paid' || state === 'expired'
  const pending = (payments.data ?? []).find((p: PlanPayment) => p.status === 'pending') ?? null
  // Same rule the database uses. Paying in advance stacks 30 days on the days left, so the new end date is
  // known now. If the plan has already ended, the 30 days start the day an admin activates it: unknown yet.
  const paidAt = pending ? new Date(pending.submittedAt) : now
  const stillActive = subscription !== null && new Date(subscription.activeUntil) > paidAt
  const runsUntil = stillActive ? dateOfInstant(extendedActiveUntil(subscription, paidAt).toISOString()) : null

  return (
    <>
      <PageHeader title="Plan" description="Keep your library visible to students for ₹199 for 30 days." />

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {state === 'trial' && (
            <StatusCard tone="primary" icon={<Hourglass />} title={`Free trial, ${dayWord(daysLeft)} left`}>
              {activeUntilDate && <p>Your trial ends on {formatDate(activeUntilDate)}. Activate the plan to stay listed.</p>}
            </StatusCard>
          )}

          {state === 'paid' && (
            <StatusCard
              tone="primary"
              icon={<CircleCheck />}
              title={`Plan active${activeUntilDate ? `, until ${formatDate(activeUntilDate)}` : ''}`}
            >
              <p>{dayWord(daysLeft)} left. Renew early and the days stack.</p>
            </StatusCard>
          )}

          {state === 'expired' && (
            <StatusCard
              tone="danger"
              icon={<TriangleAlert />}
              title={activeUntilDate ? `Expired on ${formatDate(activeUntilDate)}` : 'Your plan has expired'}
            >
              <p>Your library is hidden from students and this dashboard is read-only until you renew.</p>
            </StatusCard>
          )}

          {(state === 'pending' || state === 'rejected') && (
            <StatusCard tone="warning" icon={<Hourglass />} title="You can pay once your library is approved">
              <p>
                {state === 'pending'
                  ? 'Your library is in review. Your 14-day free trial starts when we approve it.'
                  : 'Fix the points on your library listing and resubmit it for review first.'}
              </p>
            </StatusCard>
          )}

          {canPay &&
            (payments.loading ? (
              <LoadingState layout="list" count={1} label="Loading payment details" />
            ) : payments.error ? (
              <ErrorState onRetry={payments.reload} />
            ) : !pending && upi.error ? (
              // The UPI ID comes only from the VITE_UPI_ID setting. Never show a guessed payment address.
              <ErrorState
                title="Payments aren't set up yet"
                description={import.meta.env.DEV ? upi.error : 'Please contact NearMe Library support to activate your plan.'}
              />
            ) : (
              <PaymentCard
                upiId={upi.upiId ?? ''}
                pending={pending}
                runsUntil={runsUntil}
                onSubmit={submit.run}
                submitting={submit.loading}
              />
            ))}
        </div>

        {canPay && !payments.loading && !payments.error && (
          <PaymentHistory payments={payments.data ?? []} onSubmitAgain={focusUtrForm} />
        )}
      </div>
    </>
  )
}
