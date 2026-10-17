import { Plus, X } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/Fields'
import { draftFeePaise, type ShiftDraft } from '@/components/owner/profile/shiftDrafts'
import { formatRupees } from '@/domain/money'
import { DEFAULT_SHIFTS, MAX_ACTIVE_SHIFTS } from '@/domain/shifts'
import { cx } from '@/lib/cx'

const OVERLAP_HELP = "Shifts can't overlap. A night shift can run past midnight."

/** One editable set of shift fields, used by the onboarding rows. */
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

/* New library: local rows the owner fills in before the library exists. */
export function NewShiftsField({
  drafts,
  onChange,
  error,
  badRow,
  disabled,
}: {
  drafts: ShiftDraft[]
  onChange: (drafts: ShiftDraft[]) => void
  error?: string | null
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
        <h3 className="font-semibold">Shifts and fees</h3>
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
