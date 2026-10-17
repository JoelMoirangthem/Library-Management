import { useMemo, useState } from 'react'
import { Plus, Power, X } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { TextField } from '@/components/Fields'
import {
  draftFeePaise,
  type ShiftDraft,
} from '@/components/owner/profile/shiftDrafts'
import { formatRupees } from '@/domain/money'
import {
  DEFAULT_SHIFTS,
  MAX_ACTIVE_SHIFTS,
  sortShifts,
  validateShiftFields,
} from '@/domain/shifts'
import type { Shift, ShiftInput } from '@/domain/types'
import { toAppError } from '@/domain/errors'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { services } from '@/lib/container'
import { cx } from '@/lib/cx'

const OVERLAP_HELP = "Shifts can't overlap. A night shift can run past midnight."

/** One editable set of fields shared by the new-row and existing-row editors. */
function ShiftFields({
  name,
  startTime,
  endTime,
  fee,
  onChange,
  disabled,
  feeError,
}: {
  name: string
  startTime: string
  endTime: string
  fee: string
  onChange: (patch: Partial<ShiftDraft>) => void
  disabled?: boolean
  feeError?: string
}) {
  const paise = draftFeePaise(fee)
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label="Shift name"
        value={name}
        disabled={disabled}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <TextField
        label="Monthly fee (₹)"
        type="text"
        inputMode="decimal"
        value={fee}
        disabled={disabled}
        error={feeError}
        hint={
          paise > 0 ? `Students will see ${formatRupees(paise)} / month.` : 'The monthly fee for this shift, e.g. 800.'
        }
        onChange={(e) => onChange({ fee: e.target.value })}
      />
      <div>
        <label className="mb-1.5 block text-sm font-medium">Start time</label>
        <input
          type="time"
          step={300}
          value={startTime}
          disabled={disabled}
          onChange={(e) => onChange({ startTime: e.target.value })}
          className="block min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-base text-ink disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">End time</label>
        <input
          type="time"
          step={300}
          value={endTime}
          disabled={disabled}
          onChange={(e) => onChange({ endTime: e.target.value })}
          className="block min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-base text-ink disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted"
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * New library: local rows the owner fills in before the library exists.
 * ------------------------------------------------------------------ */

export function NewShiftsField({
  drafts,
  onChange,
  error,
  badRow,
  disabled,
}: {
  drafts: ShiftDraft[]
  onChange: (drafts: ShiftDraft[]) => void
  /** Sentence shown under the block (from validateShiftSet / validateShiftFields). */
  error?: string | null
  /** Index of the row to highlight, if any. */
  badRow?: number | null
  disabled?: boolean
}) {
  const setRow = (i: number, patch: Partial<ShiftDraft>) =>
    onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)))

  const addRow = () => {
    const next = DEFAULT_SHIFTS[drafts.length] ?? { name: '', startTime: '09:00', endTime: '13:00' }
    onChange([...drafts, { name: next.name, startTime: next.startTime, endTime: next.endTime, fee: '' }])
  }

  const removeRow = (i: number) => onChange(drafts.filter((_, j) => j !== i))

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Shifts and fees</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Run up to {MAX_ACTIVE_SHIFTS} shifts, each with its own monthly fee. {OVERLAP_HELP}
        </p>
      </div>

      <ul className="space-y-4">
        {drafts.map((d, i) => (
          <li
            key={i}
            className={cx(
              'rounded-card border p-4',
              badRow === i ? 'border-danger bg-danger-soft/30' : 'border-border bg-canvas/40',
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium text-ink-muted">Shift {i + 1}</p>
              {!disabled && drafts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  aria-label={`Remove shift ${i + 1}`}
                  className="inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-sm font-medium text-danger hover:bg-danger-soft"
                >
                  <X aria-hidden className="size-4" /> Remove
                </button>
              )}
            </div>
            <ShiftFields
              name={d.name}
              startTime={d.startTime}
              endTime={d.endTime}
              fee={d.fee}
              disabled={disabled}
              onChange={(patch) => setRow(i, patch)}
            />
          </li>
        ))}
      </ul>

      {!disabled && drafts.length < MAX_ACTIVE_SHIFTS && (
        <Button variant="secondary" onClick={addRow}>
          <Plus aria-hidden className="size-4" /> Add shift
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Existing library: shifts live in the database; edit, add, switch on/off.
 * ------------------------------------------------------------------ */

function ExistingShiftRow({
  shift,
  canEdit,
  activeCount,
  onDone,
}: {
  shift: Shift
  canEdit: boolean
  /** How many shifts are currently on, for the "last one on" rule. */
  activeCount: number
  onDone: () => void
}) {
  const [draft, setDraft] = useState<ShiftDraft>({
    name: shift.name,
    startTime: shift.startTime,
    endTime: shift.endTime,
    fee: String(shift.monthlyFeePaise / 100),
  })
  const [fieldError, setFieldError] = useState<string | null>(null)

  const save = useMutation(
    (input: ShiftInput) => services.updateShift(shift.id, input),
    { success: 'Shift saved', silent: true },
  )
  const toggle = useMutation((on: boolean) => services.setShiftActive(shift.id, on), {
    success: shift.isActive ? 'Shift switched off' : 'Shift switched on',
    silent: true,
  })

  const inputOf = (): ShiftInput => ({
    name: draft.name.trim(),
    startTime: draft.startTime,
    endTime: draft.endTime,
    monthlyFeePaise: draftFeePaise(draft.fee),
  })

  async function handleSave() {
    const input = inputOf()
    const problem = validateShiftFields(input)
    setFieldError(problem)
    if (problem) return
    const ok = await save.run(input)
    if (ok !== undefined) {
      setFieldError(null)
      onDone()
    }
  }

  async function handleToggle() {
    const ok = await toggle.run(!shift.isActive)
    if (ok !== undefined) onDone()
  }

  // Switching off the only shift that is on isn't allowed.
  const offDisabled = shift.isActive && activeCount <= 1
  const message = save.error ?? toggle.error

  return (
    <li
      className={cx(
        'rounded-card border p-4',
        shift.isActive ? 'border-border bg-surface' : 'border-border bg-canvas/60 opacity-80',
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-medium">
          {shift.name}
          {!shift.isActive && <Badge tone="neutral">Off</Badge>}
        </span>
        <Button
          variant={shift.isActive ? 'secondary' : 'primary'}
          loading={toggle.loading}
          disabled={!canEdit || offDisabled}
          onClick={handleToggle}
          className="min-h-11"
        >
          <Power aria-hidden className="size-4" />
          {shift.isActive ? 'Switch off' : 'Switch on'}
        </Button>
      </div>

      <ShiftFields
        name={draft.name}
        startTime={draft.startTime}
        endTime={draft.endTime}
        fee={draft.fee}
        disabled={!canEdit}
        feeError={fieldError ?? undefined}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      />

      <p className="mt-2 text-sm text-ink-muted">
        Students already in a shift stay in it. Nothing is deleted.
      </p>

      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button loading={save.loading} onClick={handleSave}>
            Save shift
          </Button>
        </div>
      )}

      {message && (
        <p role="alert" className="mt-2 text-sm font-medium text-ink-muted">
          {message.message}
        </p>
      )}
    </li>
  )
}

function AddExistingShift({
  libraryId,
  onDone,
}: {
  libraryId: string
  onDone: () => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ShiftDraft>({ name: '', startTime: '09:00', endTime: '13:00', fee: '' })
  const [fieldError, setFieldError] = useState<string | null>(null)
  const add = useMutation((input: ShiftInput) => services.addShift(libraryId, input), {
    success: 'Shift added',
    silent: true,
  })

  async function handleAdd() {
    const input: ShiftInput = {
      name: draft.name.trim(),
      startTime: draft.startTime,
      endTime: draft.endTime,
      monthlyFeePaise: draftFeePaise(draft.fee),
    }
    const problem = validateShiftFields(input)
    setFieldError(problem)
    if (problem) return
    const ok = await add.run(input)
    if (ok !== undefined) {
      setDraft({ name: '', startTime: '09:00', endTime: '13:00', fee: '' })
      setFieldError(null)
      setOpen(false)
      onDone()
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus aria-hidden className="size-4" /> Add shift
      </Button>
    )
  }

  return (
    <div className="rounded-card border border-border bg-canvas/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium">New shift</p>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setFieldError(null)
          }}
          aria-label="Cancel new shift"
          className="inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-sm font-medium text-ink-muted hover:bg-canvas"
        >
          <X aria-hidden className="size-4" /> Cancel
        </button>
      </div>
      <ShiftFields
        name={draft.name}
        startTime={draft.startTime}
        endTime={draft.endTime}
        fee={draft.fee}
        feeError={fieldError ?? undefined}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      />
      <div className="mt-3">
        <Button loading={add.loading} onClick={handleAdd}>
          Add this shift
        </Button>
      </div>
      {add.error && (
        <p role="alert" className="mt-2 text-sm font-medium text-danger">
          {add.error.message}
        </p>
      )}
    </div>
  )
}

export function ExistingShiftsEditor({
  libraryId,
  canEdit,
}: {
  libraryId: string
  canEdit: boolean
}) {
  const shiftsQ = useAsync(() => services.listShifts(libraryId), [libraryId])
  const shifts = useMemo(() => sortShifts(shiftsQ.data ?? []), [shiftsQ.data])
  const activeCount = shifts.filter((s) => s.isActive).length

  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Shifts and fees</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Each shift has its own monthly fee. {OVERLAP_HELP}
        </p>
      </div>

      {shiftsQ.loading ? (
        <p className="text-sm text-ink-muted">Loading shifts…</p>
      ) : shiftsQ.error ? (
        <p role="alert" className="text-sm font-medium text-danger">
          {toAppError(shiftsQ.error).message}
        </p>
      ) : (
        <ul className="space-y-4">
          {shifts.map((s) => (
            <ExistingShiftRow
              key={s.id}
              shift={s}
              canEdit={canEdit}
              activeCount={activeCount}
              onDone={() => shiftsQ.reload()}
            />
          ))}
        </ul>
      )}

      {canEdit && activeCount < MAX_ACTIVE_SHIFTS && (
        <AddExistingShift libraryId={libraryId} onDone={() => shiftsQ.reload()} />
      )}
    </section>
  )
}
