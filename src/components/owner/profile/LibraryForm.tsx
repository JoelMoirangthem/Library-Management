import { useEffect, useMemo, useRef, useState } from 'react'
import { ChipCheckbox, SelectField, TextAreaField, TextField } from '@/components/Fields'
import { Button } from '@/components/Button'
import { PhotoPicker } from '@/components/owner/profile/PhotoPicker'
import { ExistingShiftsEditor, NewShiftsField } from '@/components/owner/profile/ShiftsEditor'
import {
  defaultShiftDrafts,
  draftsToShiftInputs,
  type ShiftDraft,
} from '@/components/owner/profile/shiftDrafts'
import { AMENITIES } from '@/domain/constants'
import { validateShiftFields, validateShiftSet } from '@/domain/shifts'
import type { Area, City, Library, LibraryInput, ShiftInput } from '@/domain/types'
import { validateLibraryInput, type FieldErrors } from '@/domain/validation'

type Draft = {
  name: string
  cityId: string
  areaId: string
  address: string
  landmark: string
  pincode: string
  phone: string
  capacity: string
  timings: string
  amenities: string[]
  photos: string[]
}

function toDraft(lib: Library | null): Draft {
  return {
    name: lib?.name ?? '',
    cityId: lib?.cityId ?? '',
    areaId: lib?.areaId ?? '',
    address: lib?.address ?? '',
    landmark: lib?.landmark ?? '',
    pincode: lib?.pincode ?? '',
    phone: lib?.phone ?? '',
    capacity: lib ? String(lib.capacity) : '',
    timings: lib?.timings ?? '',
    amenities: lib?.amenities ?? [],
    photos: lib?.photos ?? [],
  }
}

/** Build the typed LibraryInput from the draft. */
function toInput(d: Draft): LibraryInput {
  const capacity = Number(d.capacity)
  return {
    name: d.name.trim(),
    cityId: d.cityId,
    areaId: d.areaId,
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

const FIELD_ORDER: (keyof LibraryInput)[] = [
  'name',
  'cityId',
  'areaId',
  'address',
  'pincode',
  'phone',
  'capacity',
  'timings',
]

type Props = {
  library: Library | null
  cities: City[]
  areas: Area[]
  /** Called when the chosen city changes, so the parent can reload areas. */
  onCityChange: (cityId: string) => void
  /** For a new library, `shifts` carries the owner's shift rows; existing libraries edit shifts separately. */
  onSubmit: (input: LibraryInput, shifts?: ShiftInput[]) => void
  submitting: boolean
  submitLabel: string
  disabled?: boolean
  /** Whether lowering capacity is allowed (existing library). */
  isExisting: boolean
}

export function LibraryForm({
  library,
  cities,
  areas,
  onCityChange,
  onSubmit,
  submitting,
  submitLabel,
  disabled = false,
  isExisting,
}: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(library))
  const [errors, setErrors] = useState<FieldErrors<keyof LibraryInput>>({})
  // New-library shift rows (local until the library is created).
  const [shiftDrafts, setShiftDrafts] = useState<ShiftDraft[]>(() => defaultShiftDrafts())
  const [shiftError, setShiftError] = useState<string | null>(null)
  const [badRow, setBadRow] = useState<number | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Re-seed the draft only if the library identity changes (not on every keystroke-driven re-render).
  const libId = library?.id ?? null
  const seeded = useRef<string | null>(null)
  useEffect(() => {
    if (seeded.current !== libId) {
      seeded.current = libId
      setDraft(toDraft(library))
    }
  }, [libId, library])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const amenitySet = useMemo(() => new Set(draft.amenities), [draft.amenities])

  function focusFirstBadField(found: FieldErrors<keyof LibraryInput>): boolean {
    const firstKey = FIELD_ORDER.find((k) => found[k])
    if (!firstKey) return false
    const el = formRef.current?.querySelector<HTMLElement>(
      `[data-field="${firstKey}"] input, [data-field="${firstKey}"] select, [data-field="${firstKey}"] textarea`,
    )
    el?.focus()
    return true
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return
    const input = toInput(draft)
    const found = validateLibraryInput(input)
    setErrors(found)
    if (focusFirstBadField(found)) return

    // Existing libraries manage shifts in their own editor; the form submit never touches them.
    if (isExisting) {
      onSubmit(input)
      return
    }

    // New library: validate the shift rows too, then send both together.
    const shiftInputs = draftsToShiftInputs(shiftDrafts)
    const setProblem = validateShiftSet(shiftInputs)
    if (setProblem) {
      // Mark the first row whose own fields are wrong, if any.
      const idx = shiftInputs.findIndex((s) => validateShiftFields(s) !== null)
      setBadRow(idx >= 0 ? idx : null)
      setShiftError(setProblem)
      return
    }
    setShiftError(null)
    setBadRow(null)
    onSubmit(input, shiftInputs)
  }

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit} className="space-y-8">
      <fieldset disabled={disabled} className="space-y-8">
        <section className="space-y-5">
          <h2 className="text-lg font-semibold">About your library</h2>
          <div data-field="name">
            <TextField
              label="Library name"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              error={errors.name}
              autoComplete="organization"
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div data-field="cityId">
              <SelectField
                label="City"
                value={draft.cityId}
                error={errors.cityId}
                onChange={(e) => {
                  const cityId = e.target.value
                  setDraft((d) => ({ ...d, cityId, areaId: '' }))
                  onCityChange(cityId)
                }}
              >
                <option value="">Choose a city</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </SelectField>
            </div>
            <div data-field="areaId">
              <SelectField
                label="Area"
                value={draft.areaId}
                error={errors.areaId}
                disabled={!draft.cityId}
                hint={!draft.cityId ? 'Choose a city first.' : undefined}
                onChange={(e) => set('areaId', e.target.value)}
              >
                <option value="">Choose an area</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-lg font-semibold">Where students will find you</h2>
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
              label="Landmark"
              hint="Optional. A nearby shop or stop helps students find you."
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
              maxLength={10}
              hint="A 10-digit mobile number students can call."
              value={draft.phone}
              onChange={(e) => set('phone', e.target.value)}
              error={errors.phone}
              autoComplete="tel-national"
            />
          </div>
        </section>

        <section className="space-y-5">
          <h2 className="text-lg font-semibold">Seats and hours</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div data-field="capacity">
              <TextField
                label="Number of seats"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                hint={
                  isExisting
                    ? 'Raising this adds new seats. Lowering it only removes free seats.'
                    : 'How many study seats does your library have?'
                }
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
        </section>

        {/* Shifts: existing libraries edit live shifts; new libraries fill local rows. */}
        {isExisting && library ? (
          <ExistingShiftsEditor libraryId={library.id} canEdit={!disabled} />
        ) : (
          <NewShiftsField
            drafts={shiftDrafts}
            onChange={setShiftDrafts}
            error={shiftError}
            badRow={badRow}
            disabled={disabled}
          />
        )}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Amenities</h2>
          <p className="text-sm text-ink-muted">Pick everything your library offers.</p>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <ChipCheckbox
                key={a}
                label={a}
                checked={amenitySet.has(a)}
                disabled={disabled}
                onChange={(on) =>
                  set('amenities', on ? [...draft.amenities, a] : draft.amenities.filter((x) => x !== a))
                }
              />
            ))}
          </div>
        </section>

        <section>
          <PhotoPicker photos={draft.photos} onChange={(p) => set('photos', p)} disabled={disabled} />
        </section>
      </fieldset>

      {!disabled && (
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </div>
      )}
    </form>
  )
}
