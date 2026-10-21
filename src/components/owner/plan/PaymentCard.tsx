import { useMemo, useState } from 'react'
import { Check, ChevronDown, Copy, ExternalLink } from 'lucide-react'
import { renderSVG } from 'uqr'
import { Button, buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/Fields'
import { Steps, type StepState } from '@/components/Steps'
import { useToast } from '@/components/Toast'
import { formatDate, formatDateTime } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import { PLAN_DAYS, PLAN_PRICE_PAISE } from '@/domain/plan'
import { isValidUtr } from '@/domain/constants'
import type { PlanPayment } from '@/domain/types'
import { buildUpiLink } from '@/domain/upi'
import { cx } from '@/lib/cx'
import { BRAND } from '@/lib/brand'

/** The pay link for the UPI app and the QR code; upiId comes from the VITE_UPI_ID setting. */
function upiLink(upiId: string): string {
  return buildUpiLink({ upiId, payeeName: BRAND.upiPayeeName, amountPaise: PLAN_PRICE_PAISE, note: `${BRAND.name} plan` })
}

type Props = {
  /** The UPI ID owners pay to (from the VITE_UPI_ID setting). */
  upiId: string
  /** The payment that is currently awaiting admin review, if any. */
  pending: PlanPayment | null
  /** Date the plan will run until after this payment is verified, or null when the plan has already ended (the 30 days then start the day it is activated). */
  runsUntil: string | null
  onSubmit: (utr: string) => Promise<unknown>
  submitting: boolean
}

/** The id students' "Submit again" link focuses. */
export const UTR_INPUT_ID = 'plan-utr-input'

export function PaymentCard({ upiId, pending, runsUntil, onSubmit, submitting }: Props) {
  // A pending payment: show the progress timeline instead of the form.
  if (pending) {
    return <PendingTimeline pending={pending} />
  }
  return <PayFlow upiId={upiId} runsUntil={runsUntil} onSubmit={onSubmit} submitting={submitting} />
}

function PayFlow({
  upiId,
  runsUntil,
  onSubmit,
  submitting,
}: Omit<Props, 'pending'>) {
  const toast = useToast()
  const [utr, setUtr] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [showQrOnMobile, setShowQrOnMobile] = useState(false)

  const digits = utr.replace(/\D/g, '')
  const stepStates: StepState[] = [
    'current',
    digits.length === 12 ? 'current' : 'todo',
    'todo',
  ]

  const link = upiLink(upiId)
  const qrSvg = useMemo(() => renderSVG(link, { border: 1 }), [link])

  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(upiId)
      toast.show('UPI ID copied', 'success')
    } catch {
      toast.show('Could not copy. Note the UPI ID manually.', 'error')
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value = utr.trim()
    if (!isValidUtr(value)) {
      setFieldError('Enter the 12-digit UTR number from your UPI app.')
      return
    }
    setFieldError(undefined)
    void onSubmit(value).then((ok) => {
      if (ok !== undefined) setUtr('')
    })
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Pay for 30 days</h2>
        <p className="text-xl font-semibold tabular-nums">
          {formatRupees(PLAN_PRICE_PAISE)}
          <span className="ml-1 text-sm font-normal text-ink-muted">for {PLAN_DAYS} days</span>
        </p>
      </div>

      <Steps
        className="mt-5"
        steps={[
          { label: 'Pay ₹199', state: stepStates[0] },
          { label: 'Enter the UTR', state: stepStates[1] },
          { label: 'We verify', state: stepStates[2] },
        ]}
      />

      {/* Step 1: Pay */}
      <section className="mt-6">
        <h3 className="text-sm font-semibold">1. Pay ₹199</h3>

        {/* Mobile: big UPI button first. */}
        <a href={link} className={buttonStyles('primary', 'mt-3 w-full sm:hidden')}>
          <ExternalLink aria-hidden className="size-4" />
          Pay ₹199 with a UPI app
        </a>
        <p className="mt-2 text-sm text-ink-muted sm:hidden">
          If your UPI app does not open or shows an error, pay to the UPI ID below (type ₹199 yourself) or scan the QR from another phone. Then enter the UTR.
        </p>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 rounded-card border border-border-strong bg-canvas p-3">
            <div className="min-w-0">
              <p className="text-xs text-ink-muted">UPI ID</p>
              <p className="truncate font-medium tabular-nums">{upiId}</p>
            </div>
            <Button variant="secondary" onClick={copyUpi} className="ml-auto min-h-11 px-3">
              <Copy aria-hidden className="size-4" />
              Copy
            </Button>
          </div>

          {/* Desktop: QR beside the UPI ID. */}
          <div className="hidden sm:block">
            <QrImage svg={qrSvg} />
          </div>
        </div>

        {/* Mobile: reveal QR to pay from another phone. */}
        <div className="sm:hidden">
          <button
            type="button"
            onClick={() => setShowQrOnMobile((v) => !v)}
            aria-expanded={showQrOnMobile}
            className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary"
          >
            <ChevronDown aria-hidden className={cx('size-4 transition-transform', showQrOnMobile && 'rotate-180')} />
            Pay from another phone
          </button>
          {showQrOnMobile && (
            <div className="mt-3">
              <QrImage svg={qrSvg} />
            </div>
          )}
        </div>
      </section>

      {/* Step 2: UTR */}
      <section className="mt-6" id={UTR_INPUT_ID}>
        <form onSubmit={handleSubmit}>
          <TextField
            label="2. Enter the UTR"
            type="text"
            inputMode="numeric"
            maxLength={12}
            hint={`${digits.length} of 12 digits. The reference number shown in your UPI app after paying.`}
            value={utr}
            error={fieldError}
            onChange={(e) => setUtr(e.target.value)}
            className="[&_input]:tabular-nums"
          />
          <Button type="submit" loading={submitting} className="mt-3">
            Submit payment
          </Button>
        </form>
      </section>

      <p className="mt-5 text-sm text-ink-muted">
        {runsUntil ? (
          <>
            Renew early and the days stack: you never lose days you've already paid for. After we verify
            this payment, your plan will run until{' '}
            <span className="font-medium text-ink tabular-nums">{formatDate(runsUntil)}</span>.
          </>
        ) : (
          <>Your plan has ended, so the 30 days start on the day we verify this payment.</>
        )}
      </p>
    </Card>
  )
}

function QrImage({ svg }: { svg: string }) {
  return (
    <div
      role="img"
      aria-label={`QR code to pay ₹199 to ${BRAND.name} over UPI`}
      className="size-36 shrink-0 rounded-card border border-border bg-white p-3 [&>svg]:size-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

function PendingTimeline({ pending }: { pending: PlanPayment }) {
  const steps: { label: string; detail?: string; done: boolean; current: boolean }[] = [
    { label: 'Submitted', detail: formatDateTime(pending.submittedAt), done: true, current: false },
    { label: "We're checking", done: false, current: true },
    { label: 'Verified', done: false, current: false },
  ]
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-lg font-semibold">We're checking your payment</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Usually the same day. We'll show a message here as soon as it's checked.
      </p>
      <ol className="mt-5 space-y-4">
        {steps.map((s, i) => (
          <li key={s.label} className="flex gap-3">
            <span
              aria-hidden
              className={cx(
                'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                s.done && 'bg-primary text-white',
                s.current && 'border-2 border-primary text-primary',
                !s.done && !s.current && 'border border-border-strong text-ink-muted',
              )}
            >
              {s.done ? <Check className="size-3.5" /> : i + 1}
            </span>
            <div className="min-w-0">
              <p className={cx('font-medium', !s.done && !s.current && 'text-ink-muted')}>{s.label}</p>
              {s.detail && <p className="text-sm text-ink-muted tabular-nums">{s.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm text-ink-muted">
        UTR <span className="font-medium tabular-nums">{pending.utr}</span>.
      </p>
    </Card>
  )
}
