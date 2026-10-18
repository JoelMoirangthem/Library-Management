import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/Button'
import { SelectField, TextField } from '@/components/Fields'
import { Modal } from '@/components/Modal'
import { FEE_MODES } from '@/domain/constants'
import { addDays } from '@/domain/dates'
import { formatRupees } from '@/domain/money'
import { buildSeatCells } from '@/domain/seatCells'
import { describeShift, sortShifts } from '@/domain/shifts'
import type { FeeMode, Member, Seat, Shift } from '@/domain/types'
import { hasErrors, rupeesToPaise, validateMemberFields } from '@/domain/validation'
import { useMutation } from '@/hooks/useMutation'
import { services } from '@/lib/container'
import { NO_PAYMENT, type FeeModeChoice, isFeeMode } from '@/components/owner/members/feeFields'

type Props = {
  open: boolean
  onClose: () => void
  libraryId: string
  /** All shifts for this library; only active ones can take a new student. */
  shifts: Shift[]
  /** Physical seats, used to work out which seats are free in the chosen shift. */
  seats: Seat[]
  /** Every membership, used for free-seat maths and the "already in another shift" hint. */
  members: Member[]
  /** Pre-select this seat (e.g. opened from a free seat on the grid). */
  presetSeatId?: string | null
  /** Pre-select this shift (e.g. opened from a seat on the grid for a given shift). */
  presetShiftId?: string | null
  /** Today in IST, used as the default start date. */
  today: string
  /** Called with the new student's name so the list can show them straight away. */
  onAdded?: (name: string) => void
}

const QUICK_MONTHS = [1, 2, 3]

export function AddStudentModal({
  open,
  onClose,
  libraryId,
  shifts,
  seats,
  members,
  presetSeatId,
  presetShiftId,
  today,
  onAdded,
}: Props) {
  const activeShifts = useMemo(() => sortShifts(shifts).filter((s) => s.isActive), [shifts])

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [shiftId, setShiftId] = useState('')
  const [seatId, setSeatId] = useState('')
  const [startDate, setStartDate] = useState(today)
  const [months, setMonths] = useState(1)
  const [expiryDate, setExpiryDate] = useState(addDays(today, 30))
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<FeeModeChoice>('cash')
  const [touched, setTouched] = useState(false)
  const [amountError, setAmountError] = useState<string>()

  const selectedShift = activeShifts.find((s) => s.id === shiftId) ?? null

  // Seats free in the chosen shift, recomputed when the shift changes.
  const freeSeats = useMemo(() => {
    if (!shiftId) return []
    const cells = buildSeatCells(seats, members, today, shiftId)
    return cells.filter((c) => c.state === 'free').map((c) => ({ id: c.id, seatNumber: c.number }))
  }, [seats, members, today, shiftId])

  // Reset the form whenever the modal (re)opens.
  useEffect(() => {
    if (!open) return
    const initialShift = presetShiftId ?? activeShifts[0]?.id ?? ''
    const fee = activeShifts.find((s) => s.id === initialShift)?.monthlyFeePaise ?? 0
    setName('')
    setPhone('')
    setShiftId(initialShift)
    setSeatId(presetSeatId ?? '')
    setStartDate(today)
    setMonths(1)
    setExpiryDate(addDays(today, 30))
    setAmount(fee ? (fee / 100).toString() : '')
    setMode('cash')
    setTouched(false)
    setAmountError(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetSeatId, presetShiftId, today])

  // The shifts can finish loading after the form opened, when the reset above ran with none. Fill in the default
  // shift and its fee then, without wiping what the owner has already typed. Otherwise the dropdown looks
  // filled in (it shows the first option) while the form holds no shift and refuses to save.
  useEffect(() => {
    if (!open || shiftId || activeShifts.length === 0) return
    const initialShift = presetShiftId ?? activeShifts[0].id
    const fee = activeShifts.find((s) => s.id === initialShift)?.monthlyFeePaise ?? 0
    setShiftId(initialShift)
    setAmount((a) => (a === '' && fee ? (fee / 100).toString() : a))
  }, [open, shiftId, activeShifts, presetShiftId])

  const onShiftChange = (value: string) => {
    setShiftId(value)
    // Keep the seat only if it is free in the newly chosen shift; prefill the shift's fee.
    const stillFree = buildSeatCells(seats, members, today, value).some(
      (c) => c.id === seatId && c.state === 'free',
    )
    if (!stillFree) setSeatId('')
    const fee = activeShifts.find((s) => s.id === value)?.monthlyFeePaise ?? 0
    setAmount(fee ? (fee / 100).toString() : '')
  }

  const applyMonths = (n: number) => {
    setMonths(n)
    setExpiryDate(addDays(startDate, 30 * n))
  }

  const onStartChange = (value: string) => {
    setStartDate(value)
    setExpiryDate(addDays(value, 30 * months))
  }

  const fieldErrors = validateMemberFields(name, phone)

  // Inline hint: this phone already holds a membership in another shift here.
  const otherShiftHint = useMemo(() => {
    const p = phone.trim()
    if (!p || !selectedShift) return undefined
    const other = members.find(
      (m) => m.status === 'active' && m.phone === p && m.shiftId !== selectedShift.id,
    )
    if (!other) return undefined
    const otherShift = shifts.find((s) => s.id === other.shiftId)
    if (!otherShift) return undefined
    return `Already in ${otherShift.name}. This adds a second membership for ${selectedShift.name}.`
  }, [phone, selectedShift, members, shifts])

  const add = useMutation(services.addMember, {
    success: 'Student added',
    onSuccess: (member) => {
      onAdded?.(member.name)
      onClose()
    },
  })

  const submit = async () => {
    setTouched(true)
    setAmountError(undefined)
    if (hasErrors(fieldErrors)) return
    if (!shiftId) return
    if (expiryDate < startDate) return

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
      shiftId,
      seatId: seatId || null,
      startDate,
      expiryDate,
      firstFee,
    })
  }

  const showErr = touched
  const expiryError =
    showErr && expiryDate < startDate ? 'Expiry must be on or after the start date.' : undefined
  const shiftError = showErr && !shiftId ? 'Choose a shift.' : undefined

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
          <Button onClick={() => void submit()} loading={add.loading} disabled={activeShifts.length === 0}>
            Add student
          </Button>
        </>
      }
    >
      {activeShifts.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No shifts are switched on. Turn a shift on before adding students.
        </p>
      ) : (
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
            hint={otherShiftHint ?? '10-digit mobile number'}
            autoComplete="off"
          />

          <SelectField
            label="Shift"
            value={shiftId}
            onChange={(e) => onShiftChange(e.target.value)}
            error={shiftError}
          >
            {activeShifts.map((s) => (
              <option key={s.id} value={s.id}>
                {describeShift(s)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label={`Seat${selectedShift ? ` (${freeSeats.length} free in ${selectedShift.name})` : ''}`}
            value={seatId}
            onChange={(e) => setSeatId(e.target.value)}
          >
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
              hint={
                mode === NO_PAYMENT || !selectedShift
                  ? undefined
                  : `Suggested: ${formatRupees(selectedShift.monthlyFeePaise)}`
              }
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
      )}
    </Modal>
  )
}
