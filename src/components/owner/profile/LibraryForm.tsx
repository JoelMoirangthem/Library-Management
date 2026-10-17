import { useEffect, useMemo, useRef, useState } from 'react'
import { ChipCheckbox, SelectField, TextAreaField, TextField } from '@/components/Fields'
import { Button } from '@/components/Button'
import { PhotoPicker } from '@/components/owner/profile/PhotoPicker'
import { AMENITIES } from '@/domain/constants'
import { formatRupees } from '@/domain/money'
import type { Area, City, Library, LibraryInput } from '@/domain/types'
import { rupeesToPaise, validateLibraryInput, type FieldErrors } from '@/domain/validation'

type Draft = {
  name: string
  cityId: string
  areaId: string
  address: string
  landmark: string
  pincode: string
  phone: string
  capacity: string
  fee: string
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
    fee: lib ? String(lib.monthlyFeePaise / 100) : '',
    timings: lib?.timings ?? '',
    amenities: lib?.amenities ?? [],
    photos: lib?.photos ?? [],
  }
}

/** Build the typed LibraryInput from the draft. Paise fields fall back to -1 so validation flags them. */
function toInput(d: Draft): LibraryInput {
  const feePaise = rupeesToPaise(d.fee)
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
    monthlyFeePaise: feePaise ?? -1,
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
  'monthlyFeePaise',
  'timings',
]

type Props = {
  library: Library | null
  cities: City[]
  areas: Area[]
  /** Called when the chosen city changes, so the parent can reload areas. */
  onCityChange: (cityId: string) => void
  onSubmit: (input: LibraryInput) => void
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (disabled) return
    const input = toInput(draft)
    const found = validateLibraryInput(input)
    setErrors(found)
    const firstKey = FIELD_ORDER.find((k) => found[k])
    if (firstKey) {
      const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${firstKey}"] input, [data-field="${firstKey}"] select, [data-field="${firstKey}"] textarea`)
      el?.focus()
      return
    }
    onSubmit(input)
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
          <h2 className="text-lg font-semibold">Seats, fee and hours</h2>
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
            <div data-field="monthlyFeePaise">
              <TextField
                label="Monthly fee (₹)"
                type="text"
                inputMode="decimal"
                hint={
                  rupeesToPaise(draft.fee)
                    ? `Students will see ${formatRupees(rupeesToPaise(draft.fee)!)} per month.`
                    : 'Enter the monthly fee in rupees, e.g. 800.'
                }
                value={draft.fee}
                onChange={(e) => set('fee', e.target.value)}
                error={errors.monthlyFeePaise}
              />
            </div>
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
        </section>

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
