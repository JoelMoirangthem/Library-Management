import { useMemo, useState } from 'react'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Modal } from '@/components/Modal'
import { PageHeader } from '@/components/PageParts'
import { TextAreaField } from '@/components/Fields'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import {
  CopyButton,
  PaymentStatusBadge,
  RelativeTime,
  Segmented,
  TelLink,
  type SegOption,
} from '@/components/admin/AdminBits'
import { formatUntil } from '@/components/admin/planView'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useToast } from '@/components/Toast'
import { useTitle } from '@/hooks/useTitle'
import { services } from '@/lib/container'
import { useNow } from '@/lib/devState'
import { formatDate, formatDateTime } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import { extendedActiveUntil } from '@/domain/plan'
import type { AdminPaymentRow, Subscription } from '@/domain/types'

type Filter = 'all' | 'pending' | 'verified' | 'failed'

export default function Payments() {
  useTitle('Payments')
  const now = useNow()
  const payments = useAsync(() => services.listAllPlanPayments(), [])
  const libs = useAsync(() => services.listLibrariesForAdmin(), [])

  const [filter, setFilter] = useState<Filter>('all')
  const [verifying, setVerifying] = useState<AdminPaymentRow | null>(null)
  const [failing, setFailing] = useState<AdminPaymentRow | null>(null)

  const loading = payments.loading || libs.loading
  const error = payments.error ?? libs.error

  // Subscription by library id, from the admin library rows.
  const subByLibrary = useMemo(() => {
    const map = new Map<string, Subscription | null>()
    for (const r of libs.data ?? []) map.set(r.library.id, r.subscription)
    return map
  }, [libs.data])

  // Owner phone by library id, so pending cards can offer a tel link.
  const phoneByLibrary = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of libs.data ?? []) map.set(r.library.id, r.ownerPhone)
    return map
  }, [libs.data])

  const all = payments.data ?? []
  const pending = all.filter((p) => p.status === 'pending')
  const history = all.filter((p) => p.status !== 'pending')

  const counts = {
    all: all.length,
    pending: pending.length,
    verified: all.filter((p) => p.status === 'verified').length,
    failed: all.filter((p) => p.status === 'failed').length,
  }

  const filters: SegOption<Filter>[] = [
    { value: 'all', label: 'All', count: counts.all },
    { value: 'pending', label: 'Pending', count: counts.pending },
    { value: 'verified', label: 'Verified', count: counts.verified },
    { value: 'failed', label: 'Failed', count: counts.failed },
  ]

  const showPending = filter === 'all' || filter === 'pending'
  const historyFiltered =
    filter === 'verified'
      ? history.filter((p) => p.status === 'verified')
      : filter === 'failed'
        ? history.filter((p) => p.status === 'failed')
        : filter === 'pending'
          ? []
          : history

  return (
    <>
      <PageHeader title="Payments" description="Verify UPI payments by checking the UTR in your bank app." />

      {loading ? (
        <LoadingState layout="list" label="Loading payments" />
      ) : error ? (
        <ErrorState onRetry={() => { payments.reload(); libs.reload() }} />
      ) : (
        <div className="space-y-6">
          <Segmented options={filters} value={filter} onChange={setFilter} ariaLabel="Filter payments" />

          {showPending && (
            <section aria-labelledby="pending-heading" className="space-y-3">
              <h2 id="pending-heading" className="text-lg font-semibold">
                Waiting for you
              </h2>
              {pending.length === 0 ? (
                <EmptyState
                  title="No payments waiting"
                  description="New ones appear here when owners submit a UTR."
                />
              ) : (
                <>
                  {/* Below lg: compact cards (a table doesn't fit next to the sidebar). */}
                  <div className="space-y-3 lg:hidden">
                    {pending.map((p) => (
                      <PendingCard
                        key={p.id}
                        payment={p}
                        now={now}
                        ownerPhone={phoneByLibrary.get(p.libraryId) ?? null}
                        onVerify={() => setVerifying(p)}
                        onFail={() => setFailing(p)}
                      />
                    ))}
                  </div>
                  {/* lg+: one dense row per payment, same pattern as the history table. */}
                  <Card className="hidden overflow-hidden lg:block">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Payments waiting for verification</caption>
                      <thead className="border-b border-border bg-canvas text-ink-muted">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-medium">Library</th>
                          <th scope="col" className="px-4 py-3 font-medium">Owner</th>
                          <th scope="col" className="px-4 py-3 font-medium">Amount</th>
                          <th scope="col" className="px-4 py-3 font-medium">UTR</th>
                          <th scope="col" className="hidden px-4 py-3 font-medium xl:table-cell">Submitted</th>
                          <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {pending.map((p) => (
                          <PendingRow
                            key={p.id}
                            payment={p}
                            now={now}
                            ownerPhone={phoneByLibrary.get(p.libraryId) ?? null}
                            onVerify={() => setVerifying(p)}
                            onFail={() => setFailing(p)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </>
              )}
            </section>
          )}

          {filter !== 'pending' && (
            <section aria-labelledby="history-heading" className="space-y-3">
              <h2 id="history-heading" className="text-lg font-semibold">
                History
              </h2>
              {historyFiltered.length === 0 ? (
                <EmptyState title="Nothing here yet" description="Verified and failed payments show here." />
              ) : (
                <>
                  {/* Below lg: cards */}
                  <div className="space-y-3 lg:hidden">
                    {historyFiltered.map((p) => (
                      <HistoryCard key={p.id} payment={p} />
                    ))}
                  </div>
                  {/* lg+: table */}
                  <Card className="hidden overflow-hidden lg:block">
                    <table className="w-full text-left text-sm">
                      <caption className="sr-only">Payment history</caption>
                      <thead className="border-b border-border bg-canvas text-ink-muted">
                        <tr>
                          <th scope="col" className="px-4 py-3 font-medium">Library</th>
                          <th scope="col" className="px-4 py-3 font-medium">Owner</th>
                          <th scope="col" className="px-4 py-3 font-medium">Amount</th>
                          <th scope="col" className="px-4 py-3 font-medium">UTR</th>
                          <th scope="col" className="px-4 py-3 font-medium">Decided</th>
                          <th scope="col" className="px-4 py-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {historyFiltered.map((p) => (
                          <tr key={p.id} className="align-top">
                            <td className="px-4 py-3 font-medium">{p.libraryName}</td>
                            <td className="px-4 py-3 text-ink-muted">{p.ownerName}</td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatRupees(p.amountPaise)}</td>
                            <td className="whitespace-nowrap px-4 py-3 font-mono tabular-nums">{p.utr}</td>
                            <td className="whitespace-nowrap px-4 py-3 tabular-nums text-ink-muted">
                              {p.status === 'verified' && p.verifiedAt
                                ? `Verified ${formatDate(p.verifiedAt.slice(0, 10))}`
                                : p.verifiedAt
                                  ? formatDateTime(p.verifiedAt)
                                  : formatDateTime(p.submittedAt)}
                            </td>
                            <td className="px-4 py-3">
                              <PaymentStatusBadge status={p.status} />
                              {p.status === 'failed' && p.failureReason && (
                                <p className="mt-1 max-w-48 text-xs text-ink-muted">{p.failureReason}</p>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </>
              )}
            </section>
          )}
        </div>
      )}

      <VerifyModal
        payment={verifying}
        sub={verifying ? (subByLibrary.get(verifying.libraryId) ?? null) : null}
        now={now}
        onClose={() => setVerifying(null)}
      />
      <FailModal payment={failing} onClose={() => setFailing(null)} />
    </>
  )
}

type PendingActionProps = {
  payment: AdminPaymentRow
  now: Date
  ownerPhone: string | null
  onVerify: () => void
  onFail: () => void
}

/** Phone card. Keeps the UTR front and centre — it's what you match in the bank app. */
function PendingCard({ payment, now, ownerPhone, onVerify, onFail }: PendingActionProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words font-semibold text-ink">{payment.libraryName}</h3>
        <p className="whitespace-nowrap font-semibold tabular-nums text-ink">
          {formatRupees(payment.amountPaise)}
        </p>
      </div>

      <div className="mt-1 text-sm">
        <p className="text-ink">{payment.ownerName}</p>
        {ownerPhone && <TelLink phone={ownerPhone} className="whitespace-nowrap text-ink-muted" />}
      </div>

      <p className="mt-1 text-xs text-ink-muted">
        <RelativeTime iso={payment.submittedAt} now={now} prefix="Submitted " />
      </p>

      <div className="mt-3 rounded-control bg-accent-soft px-3 py-2.5 text-accent-ink">
        <p className="text-xs">Check your bank app for this UTR</p>
        <div className="mt-1.5 flex items-center gap-2">
          <span className="min-w-0 flex-1 break-all font-mono text-lg font-semibold tabular-nums">
            {payment.utr}
          </span>
          <CopyButton value={payment.utr} toastText="UTR copied" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <Button
          variant="primary"
          className="flex-1 px-3"
          aria-label={`Verify payment for ${payment.libraryName}`}
          onClick={onVerify}
        >
          Verify
        </Button>
        <Button
          variant="secondary"
          className="flex-1 px-3"
          aria-label={`Mark payment failed for ${payment.libraryName}`}
          onClick={onFail}
        >
          Mark failed
        </Button>
      </div>
    </Card>
  )
}

/** One table row per pending payment, from lg up. Buttons repeat, so labels name the library. */
function PendingRow({ payment, now, ownerPhone, onVerify, onFail }: PendingActionProps) {
  return (
    <tr className="align-top">
      <td className="px-4 py-3">
        <p className="break-words font-medium text-ink">{payment.libraryName}</p>
      </td>
      <td className="px-4 py-3">
        <p className="text-ink">{payment.ownerName}</p>
        {ownerPhone && <TelLink phone={ownerPhone} className="whitespace-nowrap text-ink-muted" />}
      </td>
      <td className="whitespace-nowrap px-4 py-3 tabular-nums">{formatRupees(payment.amountPaise)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap font-mono tabular-nums">{payment.utr}</span>
          <CopyButton value={payment.utr} toastText="UTR copied" />
        </div>
      </td>
      <td className="hidden whitespace-nowrap px-4 py-3 text-ink-muted xl:table-cell">
        <RelativeTime iso={payment.submittedAt} now={now} />
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center justify-end gap-2 xl:flex-nowrap">
          <Button
            variant="primary"
            className="px-3"
            aria-label={`Verify payment for ${payment.libraryName}`}
            onClick={onVerify}
          >
            Verify
          </Button>
          <Button
            variant="secondary"
            className="px-3"
            aria-label={`Mark payment failed for ${payment.libraryName}`}
            onClick={onFail}
          >
            Mark failed
          </Button>
        </div>
      </td>
    </tr>
  )
}

function HistoryCard({ payment }: { payment: AdminPaymentRow }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-ink">{payment.libraryName}</h3>
          <p className="text-sm text-ink-muted">{payment.ownerName}</p>
        </div>
        <PaymentStatusBadge status={payment.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <div>
          <dt className="text-ink-muted">Amount</dt>
          <dd className="tabular-nums">{formatRupees(payment.amountPaise)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-muted">UTR</dt>
          <dd className="break-all font-mono tabular-nums">{payment.utr}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-ink-muted">{payment.status === 'verified' ? 'Verified' : 'Decided'}</dt>
          <dd className="tabular-nums">
            {payment.status === 'verified' && payment.verifiedAt
              ? formatDate(payment.verifiedAt.slice(0, 10))
              : payment.verifiedAt
                ? formatDateTime(payment.verifiedAt)
                : formatDateTime(payment.submittedAt)}
          </dd>
        </div>
      </dl>
      {payment.status === 'failed' && payment.failureReason && (
        <p className="mt-3 rounded-control bg-danger-soft px-3 py-2 text-sm text-danger-ink">
          {payment.failureReason}
        </p>
      )}
    </Card>
  )
}

function VerifyModal({
  payment,
  sub,
  now,
  onClose,
}: {
  payment: AdminPaymentRow | null
  sub: Subscription | null
  now: Date
  onClose: () => void
}) {
  const toast = useToast()
  const { run, loading } = useMutation(services.verifyPlanPayment, { silent: true })

  if (!payment) return null
  const until = formatUntil(extendedActiveUntil(sub, now))

  async function submit() {
    if (!payment) return
    const ok = await run(payment.id)
    if (ok !== undefined) {
      toast.show('Payment verified', 'success')
      onClose()
    }
  }

  return (
    <Modal
      open={!!payment}
      onClose={onClose}
      title="Verify this payment?"
      description="Only verify after you see this UTR in your bank app."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={loading} onClick={() => void submit()}>
            Verify payment
          </Button>
        </>
      }
    >
      <dl className="divide-y divide-border">
        <div className="flex justify-between py-2 text-sm">
          <dt className="text-ink-muted">Library</dt>
          <dd className="font-medium">{payment.libraryName}</dd>
        </div>
        <div className="flex justify-between py-2 text-sm">
          <dt className="text-ink-muted">Amount</dt>
          <dd className="font-medium tabular-nums">{formatRupees(payment.amountPaise)}</dd>
        </div>
        <div className="flex justify-between gap-3 py-2 text-sm">
          <dt className="text-ink-muted">UTR</dt>
          <dd className="font-mono tabular-nums">{payment.utr}</dd>
        </div>
      </dl>
      <p className="mt-4 rounded-control bg-primary-soft px-3 py-2.5 text-sm text-primary-ink">
        The plan will run until <span className="font-semibold tabular-nums">{until}</span>.
      </p>
    </Modal>
  )
}

function FailModal({ payment, onClose }: { payment: AdminPaymentRow | null; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const { run, loading } = useMutation(services.failPlanPayment, { success: 'Payment marked as failed' })

  const trimmed = reason.trim()
  const invalid = trimmed.length === 0

  function close() {
    setReason('')
    setTouched(false)
    onClose()
  }

  async function submit() {
    if (!payment) return
    setTouched(true)
    if (invalid) return
    const ok = await run(payment.id, trimmed)
    if (ok !== undefined) close()
  }

  if (!payment) return null

  return (
    <Modal
      open={!!payment}
      onClose={close}
      title="Mark this payment as failed?"
      description={`${payment.libraryName} · ${formatRupees(payment.amountPaise)}`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="danger" loading={loading} onClick={() => void submit()}>
            Mark as failed
          </Button>
        </>
      }
    >
      <TextAreaField
        label="Reason"
        hint="Shown to the owner so they can resubmit."
        error={touched && invalid ? 'Add a reason so the owner knows what went wrong.' : undefined}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
      />
    </Modal>
  )
}
