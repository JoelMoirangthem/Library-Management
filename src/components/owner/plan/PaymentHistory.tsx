import { Badge, type BadgeTone } from '@/components/Badge'
import { Card } from '@/components/Card'
import { formatDateTime } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import type { PaymentStatus, PlanPayment } from '@/domain/types'

const STATUS: Record<PaymentStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: 'warning', label: 'Checking' },
  verified: { tone: 'success', label: 'Verified' },
  failed: { tone: 'danger', label: 'Failed' },
}

export function PaymentHistory({ payments }: { payments: PlanPayment[] }) {
  if (payments.length === 0) {
    return (
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Payment history</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Your plan payments will appear here once you make one.
        </p>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Payment history</h2>
      </div>
      <ul className="divide-y divide-border">
        {payments.map((p) => {
          const meta = STATUS[p.status]
          return (
            <li key={p.id} className="p-4 sm:px-6">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <p className="font-medium tabular-nums">{formatRupees(p.amountPaise)}</p>
                  <p className="text-sm text-ink-muted tabular-nums">
                    {formatDateTime(p.submittedAt)}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted tabular-nums">UTR {p.utr}</p>
                </div>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
              {p.status === 'failed' && p.failureReason && (
                <p className="mt-2 text-sm text-danger">
                  {p.failureReason} Resubmit with the correct 12-digit UTR from your UPI app.
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
