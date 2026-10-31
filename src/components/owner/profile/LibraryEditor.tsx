import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Power, X } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { CardBody, CardGrid, GridCard, GridItem } from '@/components/CardGrid'
import { ChipCheckbox, TextAreaField, TextField } from '@/components/Fields'
import { PlaceFields } from '@/components/PlaceFields'
import { useToast } from '@/components/Toast'
import { PhotoPicker } from '@/components/owner/profile/PhotoPicker'
import { draftFeePaise, type ShiftDraft } from '@/components/owner/profile/shiftDrafts'
import { cleanArea } from '@/domain/areas'
import { AMENITIES } from '@/domain/constants'
import { formatRupees } from '@/domain/money'
import {
  DEFAULT_SHIFTS,
  MAX_ACTIVE_SHIFTS,
  sortShifts,
  validateShiftSet,
} from '@/domain/shifts'
import type { Library, LibraryInput, Shift, ShiftInput } from '@/domain/types'
import { validateLibraryInput, type FieldErrors } from '@/domain/validation'
import { usePlaceOptions } from '@/hooks/usePlaceOptions'
import { cx } from '@/lib/cx'

type Draft = {
  name: string
  stateId: string
  districtId: string
  cityId: string
  /** Typed by the owner; '' = no area. */
  area: string
  address: string
  landmark: string
  pincode: string
  phone: string
  capacity: string
  timings: string
  amenities: string[]
  photos: string[]
}

function toDraft(lib: Library): Draft {
  return {
    name: lib.name,
    stateId: lib.stateId,
    districtId: lib.districtId,
    cityId: lib.cityId,
    area: lib.area,
    address: lib.address,
    landmark: lib.landmark,
    pincode: lib.pincode,
    phone: lib.phone,
    capacity: String(lib.capacity),
    timings: lib.timings,
    amenities: lib.amenities,
    photos: lib.photos,
  }
}

function toInput(d: Draft): LibraryInput {
  const capacity = Number(d.capacity)
  return {
    name: d.name.trim(),
    stateId: d.stateId,
    districtId: d.districtId,
    cityId: d.cityId,
    area: cleanArea(d.area),
    address: d.address.trim(),
    landmark: d.landmark.trim(),
    pincode: d.pincode.trim(),
    phone: d.phone.trim(),
    capacity: Number.isInteger(capacity) ? capacity : NaN,
    timings: d.timings.trim(),
    amenities: d.amenities,
    photos: d.photos,
  }
}

/** A shift row in the editor: existing rows carry an id; new rows carry a temp key only. */
type ShiftRow = ShiftDraft & { id: string | null; isActive: boolean; key: string }

function shiftToRow(s: Shift): ShiftRow {
  return {
    id: s.id,
    key: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    fee: String(s.monthlyFeePaise / 100),
    isActive: s.isActive,
  }
}

function rowToInput(r: ShiftRow): ShiftInput {
  return {
    name: r.name.trim(),
    startTime: r.startTime,
    endTime: r.endTime,
    monthlyFeePaise: draftFeePaise(r.fee),
  }
}

const FIELD_ORDER: (keyof LibraryInput)[] = [
  'name',
  'stateId',
  'districtId',
  'cityId',
  'area',
  'address',
  'pincode',
  'phone',
  'capacity',
  'timings',
]

type Props = {
  library: Library
  shifts: Shift[]
  /** Persist library + edited/new shifts together. Returns true on success. */
  onSave: (input: LibraryInput, changed: { id: string; input: ShiftInput }[], added: ShiftInput[]) => Promise<boolean>
  /** Immediate switch on/off of one shift. Returns true on success. */
  onToggleShift: (shiftId: string, on: boolean) => Promise<boolean>
  saving: boolean
  isRejected: boolean
}

/** Edit mode: grouped cards and one sticky "Save changes" bar for the whole page. */
export function LibraryEditor({
  library,
  shifts,
  onSave,
  onToggleShift,
  saving,
  isRejected,
}: Props) {
  const toast = useToast()
  const initialDraft = useMemo(() => toDraft(library), [library])
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const places = usePlaceOptions(draft)
  const [errors, setErrors] = useState<FieldErrors<keyof LibraryInput>>({})

  const sorted = useMemo(() => sortShifts(shifts), [shifts])
  const initialRows = useMemo(() => sorted.map(shiftToRow), [sorted])
  const [rows, setRows] = useState<ShiftRow[]>(initialRows)
  const [shiftError, setShiftError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const tempKey = useRef(0)

  // Re-seed when the library identity or the loaded shift set changes (e.g. after a toggle reload).
  const seedId = `${library.id}:${sorted.map((s) => `${s.id}@${s.isActive}`).join(',')}`
  const seeded = useRef<string>('')
  useEffect(() => {
    if (seeded.current !== seedId) {
      seeded.current = seedId
      setDraft(toDraft(library))
      setRows(sorted.map(shiftToRow))
    }
  }, [seedId, library, sorted])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const amenitySet = useMemo(() => new Set(draft.amenities), [draft.amenities])

  // Dirtiness: compare the library draft and shift rows to their seeded values.
  const libDirty = useMemo(
    () => JSON.stringify(toInput(draft)) !== JSON.stringify(toInput(initialDraft)),
    [draft, initialDraft],
  )
  const shiftsDirty = useMemo(() => {
    if (rows.length !== initialRows.length) return true
    return rows.some((r, i) => {
      const o = initialRows[i]
      return !o || r.id !== o.id || r.name !== o.name || r.startTime !== o.startTime || r.endTime !== o.endTime || r.fee !== o.fee
    })
  }, [rows, initialRows])
  const dirty = libDirty || shiftsDirty

  // Warn on page unload while there are unsaved changes.
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  function focusFirstBadField(found: FieldErrors<keyof LibraryInput>): boolean {
    const firstKey = FIELD_ORDER.find((k) => found[k])
    if (!firstKey) return false
    formRef.current
      ?.querySelector<HTMLElement>(
        `[data-field="${firstKey}"] input, [data-field="${firstKey}"] select, [data-field="${firstKey}"] textarea`,
      )
      ?.focus()
    return true
  }

  const setRow = (key: string, patch: Partial<ShiftRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const addRow = () => {
    const next = DEFAULT_SHIFTS[rows.length] ?? { name: '', startTime: '09:00', endTime: '13:00' }
    tempKey.current += 1
    setRows((rs) => [
      ...rs,
      { id: null, key: `new-${tempKey.current}`, name: next.name, startTime: next.startTime, endTime: next.endTime, fee: '', isActive: true },
    ])
  }

  const removeNewRow = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key))

  const activeCount = rows.filter((r) => r.isActive).length

  function discard() {
    setDraft(toDraft(library))
    setRows(sorted.map(shiftToRow))
    setErrors({})
    setShiftError(null)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const input = toInput(draft)
    const found = validateLibraryInput(input)
    setErrors(found)
    if (focusFirstBadField(found)) return

    // Validate the active shift set.
    const activeInputs = rows.filter((r) => r.isActive).map(rowToInput)
    const setProblem = validateShiftSet(activeInputs)
    if (setProblem) {
      setShiftError(setProblem)
      return
    }
    setShiftError(null)

    // Split into changed (existing, id + input) and added (new).
    const changed: { id: string; input: ShiftInput }[] = []
    const added: ShiftInput[] = []
    for (const r of rows) {
      const original = initialRows.find((o) => o.id === r.id && r.id !== null)
      if (r.id === null) {
        added.push(rowToInput(r))
      } else if (
        original &&
        (r.name !== original.name || r.startTime !== original.startTime || r.endTime !== original.endTime || r.fee !== original.fee)
      ) {
        changed.push({ id: r.id, input: rowToInput(r) })
      }
    }
    await onSave(input, changed, added)
  }

  async function handleToggle(row: ShiftRow) {
    if (!row.id) return
    const next = !row.isActive
    const ok = await onToggleShift(row.id, next)
    if (ok) {
      toast.show(next ? 'Shift switched on' : 'Shift switched off', 'success', {
        action: { label: 'Undo', onClick: () => void onToggleShift(row.id!, !next) },
      })
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSave} className="space-y-6 pb-28">
      {/* About + Where students find you: side by side on desktop, equal height. */}
      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        {/* About */}
        <Card className="flex min-h-full flex-1 flex-col p-5 sm:p-6 lg:col-start-1 lg:row-start-1">
          <h2 className="text-lg font-semibold">About</h2>
          <div className="mt-5 space-y-5">
            <div data-field="name">
              <TextField
                label="Library name"
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                error={errors.name}
                autoComplete="organization"
              />
            </div>
          </div>
        </Card>

        {/* Where students find you */}
        <Card className="flex min-h-full flex-1 flex-col p-5 sm:p-6 lg:col-start-2 lg:row-start-1 lg:row-span-3">
        <h2 className="text-lg font-semibold">Where students find you</h2>
        <div className="mt-5 space-y-5">
          <PlaceFields
            mode="form"
            value={draft}
            options={places}
            errors={errors}
            onChange={(p) => {
              setDraft((d) => ({ ...d, ...p }))
              setErrors((e) => ({ ...e, stateId: undefined, districtId: undefined, cityId: undefined, area: undefined }))
            }}
          />
          <div data-field="address">
            <TextAreaField
              label="Address"
              value={draft.address}
              onChange={(e) => set('address', e.target.value)}
              error={errors.address}
              autoComplete="street-address"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              label="Landmark (optional)"
              hint="A nearby shop or stop helps students find you."
              value={draft.landmark}
              onChange={(e) => set('landmark', e.target.value)}
            />
            <div data-field="pincode">
              <TextField
                label="Pincode"
                inputMode="numeric"
                maxLength={6}
                value={draft.pincode}
                onChange={(e) => set('pincode', e.target.value)}
                error={errors.pincode}
                autoComplete="postal-code"
              />
            </div>
          </div>
          <div data-field="phone">
            <TextField
              label="Phone number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              hint="A 10-digit mobile number students can call."
              value={draft.phone}
              onChange={(e) => set('phone', e.target.value)}
              error={errors.phone}
            />
          </div>
        </div>
        </Card>

        {/* Seats and hours */}
        <Card className="flex min-h-full flex-1 flex-col p-5 sm:p-6 lg:col-start-1 lg:row-start-2">
          <h2 className="text-lg font-semibold">Seats and hours</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div data-field="capacity">
              <TextField
                label="Number of seats"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                hint="Raising this adds new seats. Lowering it only removes free seats."
                value={draft.capacity}
                onChange={(e) => set('capacity', e.target.value)}
                error={errors.capacity}
              />
            </div>
            <div data-field="timings">
              <TextField
                label="Timings"
                hint="e.g. 6 am – 11 pm, all days"
                value={draft.timings}
                onChange={(e) => set('timings', e.target.value)}
                error={errors.timings}
              />
            </div>
          </div>
        </Card>

        {/* Amenities */}
        <Card className="flex min-h-full flex-1 flex-col p-5 sm:p-6 lg:col-start-1 lg:row-start-3">
          <h2 className="text-lg font-semibold">Amenities</h2>
          <p className="mt-1 text-sm text-ink-muted">Pick everything your library offers.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <ChipCheckbox
                key={a}
                label={a}
                checked={amenitySet.has(a)}
                onChange={(on) =>
                  set('amenities', on ? [...draft.amenities, a] : draft.amenities.filter((x) => x !== a))
                }
              />
            ))}
          </div>
        </Card>
      </div>

      {/* Shifts and fees */}
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Shifts and fees</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Each shift has its own monthly fee. Shifts can't overlap; a night shift can run past midnight.
        </p>
        <CardGrid count={rows.length} max={3} className="mt-5">
          {rows.map((r) => (
            <GridItem key={r.key}>
              <GridCard
                className={cx(
                  r.isActive ? 'bg-surface' : 'bg-canvas/60 opacity-80',
                )}
              >
                <CardBody className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      {r.name || 'New shift'}
                      {!r.isActive && <Badge tone="neutral">Off</Badge>}
                    </span>
                    {r.id ? (
                      <Button
                        variant={r.isActive ? 'secondary' : 'primary'}
                        disabled={r.isActive && activeCount <= 1}
                        onClick={() => void handleToggle(r)}
                        className="min-h-11"
                      >
                        <Power aria-hidden className="size-4" />
                        {r.isActive ? 'Switch off' : 'Switch on'}
                      </Button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removeNewRow(r.key)}
                        aria-label="Remove new shift"
                        className="inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-sm font-medium text-danger hover:bg-danger-soft"
                      >
                        <X aria-hidden className="size-4" /> Remove
                      </button>
                    )}
                  </div>
                  <div className="space-y-4">
                    <TextField
                      label="Shift name"
                      value={r.name}
                      disabled={!r.isActive}
                      onChange={(e) => setRow(r.key, { name: e.target.value })}
                    />
                    <TextField
                      label="Monthly fee (₹)"
                      type="text"
                      inputMode="decimal"
                      value={r.fee}
                      disabled={!r.isActive}
                      hint={
                        draftFeePaise(r.fee) > 0
                          ? `Students will see ${formatRupees(draftFeePaise(r.fee))} / month.`
                          : 'The monthly fee for this shift, e.g. 800.'
                      }
                      onChange={(e) => setRow(r.key, { fee: e.target.value })}
                    />
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">Start time</label>
                      <input
                        type="time"
                        step={300}
                        value={r.startTime}
                        disabled={!r.isActive}
                        onChange={(e) => setRow(r.key, { startTime: e.target.value })}
                        className="block min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-base text-ink disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium">End time</label>
                      <input
                        type="time"
                        step={300}
                        value={r.endTime}
                        disabled={!r.isActive}
                        onChange={(e) => setRow(r.key, { endTime: e.target.value })}
                        className="block min-h-11 w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-base text-ink disabled:cursor-not-allowed disabled:bg-canvas disabled:text-ink-muted"
                      />
                    </div>
                  </div>
                  <p className="text-sm text-ink-muted">
                    Students already in a shift stay in it. Nothing is deleted.
                  </p>
                </CardBody>
              </GridCard>
            </GridItem>
          ))}
        </CardGrid>
        {activeCount < MAX_ACTIVE_SHIFTS && (
          <Button variant="secondary" onClick={addRow} className="mt-4">
            <Plus aria-hidden className="size-4" /> Add shift
          </Button>
        )}
        {shiftError && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {shiftError}
          </p>
        )}
      </Card>

      {/* Photos */}
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold">Photos</h2>
        <div className="mt-4">
          <PhotoPicker photos={draft.photos} onChange={(p) => set('photos', p)} />
        </div>
      </Card>

      {/*
        Save bar: always visible so owners can see how to save. On phones it sits just above the bottom tab bar
        (56px tall + 1px border), which would otherwise cover it; on desktop it starts after the 16rem sidebar.
      */}
      <div
        data-testid="library-save-bar"
        className="fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-40 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0 md:left-64 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-ink-muted" aria-live="polite">
            {dirty ? 'You have unsaved changes' : 'All changes saved'}
          </p>
          <div className="flex gap-3">
            {dirty && (
              <Button variant="secondary" onClick={discard} disabled={saving} className="min-h-11">
                Discard
              </Button>
            )}
            <Button type="submit" loading={saving} disabled={!dirty} className="min-h-11">
              {isRejected ? 'Save and resubmit' : 'Save changes'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
