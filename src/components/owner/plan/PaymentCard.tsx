import { useState } from 'react'
import { Clock, Copy, ExternalLink } from 'lucide-react'
import { Button, buttonStyles } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/Fields'
import { useToast } from '@/components/Toast'
import { formatDate } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import { ADMIN_UPI_ID, PLAN_DAYS, PLAN_PRICE_PAISE } from '@/domain/plan'
import { isValidUtr } from '@/domain/constants'
import type { PlanPayment } from '@/domain/types'

const RUPEES = PLAN_PRICE_PAISE / 100
const upiLink = `upi://pay?pa=${encodeURIComponent(ADMIN_UPI_ID)}&pn=StudySeat&am=${RUPEES}&cu=INR&tn=${encodeURIComponent('StudySeat plan')}`

type Props = {
  /** The payment that is currently awaiting admin review, if any. */
  pending: PlanPayment | null
  /** Human date the plan would run until after this payment is verified. */
  runsUntil: string
  onSubmit: (utr: string) => Promise<unknown>
  submitting: boolean
}

export function PaymentCard({ pending, runsUntil, onSubmit, submitting }: Props) {
  const toast = useToast()
  const [utr, setUtr] = useState('')
  const [fieldError, setFieldError] = useState<string | undefined>()

  async function copyUpi() {
    try {
      await navigator.clipboard.writeText(ADMIN_UPI_ID)
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
        <h2 className="text-lg font-semibold">Pay for 30 more days</h2>
        <p className="text-xl font-semibold tabular-nums">
          {formatRupees(PLAN_PRICE_PAISE)}
          <span className="ml-1 text-sm font-normal text-ink-muted">/ {PLAN_DAYS} days</span>
        </p>
      </div>

      <p className="mt-2 max-w-prose text-sm text-ink-muted">
        Renew early and the days stack: you never lose days you've already paid for. After we
        verify this payment, your plan will run until{' '}
        <span className="font-medium text-ink tabular-nums">{formatDate(runsUntil)}</span>.
      </p>

      {pending ? (
        <div
          role="status"
          className="mt-5 flex items-start gap-3 rounded-card border border-warning/30 bg-warning-soft p-4 text-warning-ink"
        >
          <span aria-hidden className="mt-0.5 [&>svg]:size-5">
            <Clock />
          </span>
          <div>
            <p className="text-sm font-semibold">We're checking your payment</p>
            <p className="mt-1 text-sm">
              Usually within a few hours. UTR{' '}
              <span className="font-medium tabular-nums">{pending.utr}</span>.
            </p>
          </div>
        </div>
      ) : (
        <>
          <ol className="mt-5 space-y-5">
            <li>
              <p className="text-sm font-medium">1. Pay {formatRupees(PLAN_PRICE_PAISE)} to this UPI ID</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-card border border-border-strong bg-canvas p-3">
                <span className="font-medium tabular-nums">{ADMIN_UPI_ID}</span>
                <div className="ml-auto flex gap-2">
                  <Button variant="secondary" onClick={copyUpi} className="px-3">
                    <Copy aria-hidden className="size-4" />
                    Copy
                  </Button>
                  <a href={upiLink} className={buttonStyles('secondary', 'px-3 sm:hidden')}>
                    <ExternalLink aria-hidden className="size-4" />
                    Pay with a UPI app
                  </a>
                </div>
              </div>
              <a
                href={upiLink}
                className="mt-2 hidden text-sm font-medium text-primary hover:underline sm:inline-flex sm:items-center sm:gap-1"
              >
                <ExternalLink aria-hidden className="size-4" />
                Pay with a UPI app
              </a>
            </li>
            <li>
              <form onSubmit={handleSubmit}>
                <TextField
                  label="2. Enter the UTR (reference number from your UPI app)"
                  inputMode="numeric"
                  maxLength={12}
                  hint="A 12-digit number shown in your UPI app after the payment."
                  value={utr}
                  error={fieldError}
                  onChange={(e) => setUtr(e.target.value)}
                />
                <Button type="submit" loading={submitting} className="mt-3">
                  Submit payment
                </Button>
              </form>
            </li>
          </ol>
        </>
      )}
    </Card>
  )
}
