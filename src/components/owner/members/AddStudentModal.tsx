import { useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { SelectField, TextField } from '@/components/Fields'
import { Modal } from '@/components/Modal'
import { FEE_MODES } from '@/domain/constants'
import { addDays } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import type { FeeMode, Seat } from '@/domain/types'
import { hasErrors, rupeesToPaise, validateMemberFields } from '@/domain/validation'
import { useMutation } from '@/hooks/useMutation'
import { services } from '@/lib/container'
import { NO_PAYMENT, type FeeModeChoice, isFeeMode } from '@/components/owner/members/feeFields'

type FreeSeat = Pick<Seat, 'id' | 'seatNumber'>

type Props = {
  open: boolean
  onClose: () => void
  libraryId: string
  monthlyFeePaise: number
  /** Free seats the student may be assigned to (active + unoccupied). */
  freeSeats: FreeSeat[]
  /** Pre-select this seat (e.g. opened from a free seat on the grid). */
  presetSeatId?: string | null
  /** Today in IST, used as the default start date. */
  today: string
  onAdded?: () => void
}

const QUICK_MONTHS = [1, 2, 3]

export function AddStudentModal({
  open,
  onClose,
  libraryId,
  monthlyFeePaise,
  freeSeats,
  presetSeatId,
  today,
  onAdded,
}: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [seatId, setSeatId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [months, setMonths] = useState(1)
  const [expiryDate, setExpiryDate] = useState(addDays(today, 30))
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<FeeModeChoice>('cash')
  const [touched, setTouched] = useState(false)
  const [amountError, setAmountError] = useState<string>()

  // Reset the form whenever the modal (re)opens.
  useEffect(() => {
    if (!open) return
    setName('')
    setPhone('')
    setSeatId(presetSeatId ?? '')
    setStartDate(today)
    setMonths(1)
    setExpiryDate(addDays(today, 30))
    setAmount((monthlyFeePaise / 100).toString())
    setMode('cash')
    setTouched(false)
    setAmountError(undefined)
  }, [open, presetSeatId, today, monthlyFeePaise])

  const applyMonths = (n: number) => {
    setMonths(n)
    setExpiryDate(addDays(startDate, 30 * n))
  }

  const onStartChange = (value: string) => {
    setStartDate(value)
    setExpiryDate(addDays(value, 30 * months))
  }

  const fieldErrors = validateMemberFields(name, phone)

  const add = useMutation(services.addMember, {
    success: 'Student added',
    onSuccess: () => {
      onAdded?.()
      onClose()
    },
  })

  const submit = async () => {
    setTouched(true)
    setAmountError(undefined)
    if (hasErrors(fieldErrors)) return
    if (expiryDate < startDate) {
      setAmountError(undefined)
      return
    }

    let firstFee: { amountPaise: number; mode: FeeMode } | undefined
    if (mode !== NO_PAYMENT) {
      const paise = rupeesToPaise(amount)
      if (paise === null || paise <= 0) {
        setAmountError('Enter the amount in rupees, or choose “No payment yet”.')
        return
      }
      firstFee = { amountPaise: paise, mode }
    }

    await add.run({
      libraryId,
      name: name.trim(),
      phone: phone.trim(),
      seatId: seatId || null,
      startDate,
      expiryDate,
      firstFee,
    })
  }

  const showErr = touched
  const expiryError =
    showErr && expiryDate < startDate ? 'Expiry must be on or after the start date.' : undefined

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add student"
      description="Enter the student’s details and their first month."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={add.loading}>
            Add student
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={showErr ? fieldErrors.name : undefined}
          autoComplete="off"
        />
        <TextField
          label="Phone"
          inputMode="numeric"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={showErr ? fieldErrors.phone : undefined}
          hint="10-digit mobile number"
          autoComplete="off"
        />
        <SelectField label="Seat" value={seatId} onChange={(e) => setSeatId(e.target.value)}>
          <option value="">No seat yet</option>
          {freeSeats.map((s) => (
            <option key={s.id} value={s.id}>
              Seat {s.seatNumber}
            </option>
          ))}
        </SelectField>

        <TextField
          label="Start date"
          type="date"
          value={startDate}
          onChange={(e) => onStartChange(e.target.value)}
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium">Duration</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Duration in months">
            {QUICK_MONTHS.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={months === n}
                onClick={() => applyMonths(n)}
                className={
                  'inline-flex min-h-11 items-center rounded-control border px-4 text-sm font-medium transition-colors ' +
                  (months === n
                    ? 'border-primary bg-primary-soft text-primary-ink'
                    : 'border-border-strong bg-surface text-ink hover:bg-canvas')
                }
              >
                {n} month{n === 1 ? '' : 's'}
              </button>
            ))}
          </div>
        </div>

        <TextField
          label="Expiry date"
          type="date"
          value={expiryDate}
          min={startDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          error={expiryError}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="First payment"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={mode === NO_PAYMENT}
            hint={mode === NO_PAYMENT ? undefined : `Suggested: ${formatRupees(monthlyFeePaise)}`}
            error={amountError}
          />
          <SelectField
            label="Payment mode"
            value={mode}
            onChange={(e) => setMode(isFeeMode(e.target.value) ? e.target.value : NO_PAYMENT)}
          >
            {FEE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
            <option value={NO_PAYMENT}>No payment yet</option>
          </SelectField>
        </div>
      </div>
    </Modal>
  )
}
