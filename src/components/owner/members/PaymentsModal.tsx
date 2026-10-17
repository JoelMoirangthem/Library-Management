import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { SelectField, TextField } from '@/components/Fields'
import { Modal } from '@/components/Modal'
import { FEE_MODES } from '@/domain/constants'
import { formatDate } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import type { FeeMode, Member } from '@/domain/types'
import { rupeesToPaise } from '@/domain/validation'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { services } from '@/lib/container'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'

const modeLabel = (mode: FeeMode) => FEE_MODES.find((m) => m.value === mode)?.label ?? mode

type Props = {
  open: boolean
  onClose: () => void
  member: Member | null
  monthlyFeePaise: number
  /** Today in IST, default date for a new payment. */
  today: string
  /** When false (expired plan) the record/void forms are hidden. */
  canWrite: boolean
}

export function PaymentsModal({ open, onClose, member, monthlyFeePaise, today, canWrite }: Props) {
  const memberId = member?.id ?? null
  const fees = useAsync(
    () => (memberId && open ? services.listMemberFees(memberId) : Promise.resolve([])),
    [memberId, open],
  )

  const [voidingId, setVoidingId] = useState<string | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidError, setVoidError] = useState<string>()

  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(today)
  const [mode, setMode] = useState<FeeMode>('cash')
  const [recordError, setRecordError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setVoidingId(null)
    setVoidReason('')
    setVoidError(undefined)
    setAmount((monthlyFeePaise / 100).toString())
    setPaidOn(today)
    setMode('cash')
    setRecordError(undefined)
  }, [open, monthlyFeePaise, today])

  const voidFee = useMutation(services.voidFee, {
    success: 'Payment voided',
    onSuccess: () => {
      setVoidingId(null)
      setVoidReason('')
    },
  })
  const recordFee = useMutation(services.recordFee, {
    success: 'Payment recorded',
    onSuccess: () => {
      setAmount((monthlyFeePaise / 100).toString())
      setMode('cash')
    },
  })

  if (!member) return null

  const submitVoid = async (feeId: string) => {
    setVoidError(undefined)
    if (!voidReason.trim()) {
      setVoidError('Enter a reason so you remember why.')
      return
    }
    await voidFee.run(feeId, voidReason.trim())
  }

  const submitRecord = async () => {
    setRecordError(undefined)
    const paise = rupeesToPaise(amount)
    if (paise === null || paise <= 0) {
      setRecordError('Enter the amount in rupees.')
      return
    }
    await recordFee.run({ memberId: member.id, amountPaise: paise, paidOn, mode })
  }

  const list = fees.data ?? []

  return (
    <Modal open={open} onClose={onClose} title={`Payments for ${member.name}`}>
      <div className="space-y-6">
        {fees.loading ? (
          <LoadingState label="Loading payments" count={2} />
        ) : fees.error ? (
          <ErrorState onRetry={fees.reload} />
        ) : list.length === 0 ? (
          <p className="text-sm text-ink-muted">No payments recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-card border border-border">
            {list.map((f) => (
              <li key={f.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={'font-medium tabular-nums ' + (f.isVoid ? 'text-ink-muted line-through' : '')}>
                      {formatRupees(f.amountPaise)}
                    </p>
                    <p className="text-sm text-ink-muted tabular-nums">
                      {formatDate(f.paidOn)} · {modeLabel(f.mode)}
                    </p>
                    {f.isVoid && f.voidReason && (
                      <p className="mt-1 text-sm text-danger">Voided: {f.voidReason}</p>
                    )}
                  </div>
                  {canWrite && !f.isVoid && voidingId !== f.id && (
                    <Button variant="ghost" className="min-h-11 px-3" onClick={() => setVoidingId(f.id)}>
                      Void
                    </Button>
                  )}
                </div>
                {canWrite && voidingId === f.id && (
                  <div className="mt-3 space-y-2">
                    <TextField
                      label="Reason for voiding"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      error={voidError}
                      autoComplete="off"
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        className="min-h-11"
                        loading={voidFee.loading}
                        onClick={() => void submitVoid(f.id)}
                      >
                        Void payment
                      </Button>
                      <Button variant="secondary" className="min-h-11" onClick={() => setVoidingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canWrite ? (
          <div className="border-t border-border pt-5">
            <h3 className="text-lg font-semibold">Record payment</h3>
            <div className="mt-3 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  error={recordError}
                />
                <TextField label="Paid on" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
              </div>
              <SelectField label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value as FeeMode)}>
                {FEE_MODES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </SelectField>
              <Button loading={recordFee.loading} onClick={() => void submitRecord()}>
                Record payment
              </Button>
            </div>
          </div>
        ) : (
          <p className="border-t border-border pt-5 text-sm text-ink-muted">
            Renew your plan to record or void payments.
          </p>
        )}
      </div>
    </Modal>
  )
}
