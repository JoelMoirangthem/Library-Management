import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { SelectField, TextField } from '@/components/Fields'
import { Modal } from '@/components/Modal'
import { FEE_MODES } from '@/domain/constants'
import { addDays, formatDate } from '@/domain/dates'
import { renewalExpiry } from '@/domain/members'
import { formatRupees } from '@/domain/money'
import type { FeeMode, Member } from '@/domain/types'
import { rupeesToPaise } from '@/domain/validation'
import { useMutation } from '@/hooks/useMutation'
import { services } from '@/lib/container'

type Props = {
  open: boolean
  onClose: () => void
  member: Member | null
  /** The fee of the member's own shift, used as the default amount. */
  shiftFeePaise: number
  /** Today in IST. */
  today: string
  onRenewed?: () => void
}

export function RenewModal({ open, onClose, member, shiftFeePaise, today, onRenewed }: Props) {
  const [newExpiry, setNewExpiry] = useState('')
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<FeeMode>('cash')
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open || !member) return
    setNewExpiry(renewalExpiry(member, today))
    setAmount(shiftFeePaise ? (shiftFeePaise / 100).toString() : '')
    setMode('cash')
    setError(undefined)
  }, [open, member, today, shiftFeePaise])

  const renew = useMutation(services.renewMember, {
    success: newExpiry ? `Renewed until ${formatDate(newExpiry)}` : 'Renewed',
    onSuccess: () => {
      onRenewed?.()
      onClose()
    },
  })

  if (!member) return null

  const submit = async () => {
    setError(undefined)
    if (newExpiry <= member.expiryDate) {
      setError(`New expiry must be after the current expiry (${formatDate(member.expiryDate)}).`)
      return
    }
    const paise = rupeesToPaise(amount)
    if (paise === null || paise <= 0) {
      setError('Enter the amount in rupees.')
      return
    }
    await renew.run({ memberId: member.id, amountPaise: paise, mode, newExpiry })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Renew ${member.name}`}
      description={`Current expiry: ${formatDate(member.expiryDate)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={renew.loading}>
            Renew
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="New expiry"
          type="date"
          value={newExpiry}
          min={addDays(member.expiryDate, 1)}
          onChange={(e) => setNewExpiry(e.target.value)}
          error={error && newExpiry <= member.expiryDate ? error : undefined}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            hint={`Suggested: ${formatRupees(shiftFeePaise)}`}
            error={error && newExpiry > member.expiryDate ? error : undefined}
          />
          <SelectField label="Payment mode" value={mode} onChange={(e) => setMode(e.target.value as FeeMode)}>
            {FEE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>
    </Modal>
  )
}
