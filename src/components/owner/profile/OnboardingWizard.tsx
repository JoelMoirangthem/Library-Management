import { useEffect, useMemo, useRef, useState } from 'react'
import { ChipCheckbox, SelectField, TextAreaField, TextField } from '@/components/Fields'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Steps, type StepState } from '@/components/Steps'
import { PhotoPicker } from '@/components/owner/profile/PhotoPicker'
import { NewShiftsField } from '@/components/owner/profile/ShiftsEditor'
import {
  defaultShiftDrafts,
  draftsToShiftInputs,
  type ShiftDraft,
} from '@/components/owner/profile/shiftDrafts'
import { AMENITIES, formatPhone, normalizePhone } from '@/domain/constants'
import { formatRupees } from '@/domain/money'
import { validateShiftFields, validateShiftSet } from '@/domain/shifts'
import type { Area, City, LibraryInput, ShiftInput } from '@/domain/types'
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

const EMPTY: Draft = {
  name: '',
  cityId: '',
  areaId: '',
  address: '',
  landmark: '',
  pincode: '',
  phone: '',
  capacity: '',
  timings: '',
  amenities: [],
  photos: [],
}

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

const STEP_LABELS = ['Library', 'Shifts', 'Extras']
const STEP_TITLES = ['Your library', 'Seats and shifts', 'Photos and extras']
// Which LibraryInput fields each step owns, in focus order.
const STEP_FIELDS: (keyof LibraryInput)[][] = [
  ['name', 'cityId', 'areaId', 'address', 'pincode', 'phone'],
  ['capacity', 'timings'],
  [],
]

type Props = {
  cities: City[]
  areas: Area[]
  onCityChange: (cityId: string) => void
  onSubmit: (input: LibraryInput, shifts: ShiftInput[]) => void
  submitting: boolean
  error?: string | null
}

/** First-time owner onboarding: a 3-step wizard with a sticky action bar on phones. */
export function OnboardingWizard({ cities, areas, onCityChange, onSubmit, submitting, error }: Props) {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [errors, setErrors] = useState<FieldErrors<keyof LibraryInput>>({})
  const [shiftDrafts, setShiftDrafts] = useState<ShiftDraft[]>(() => defaultShiftDrafts())
  const [shiftError, setShiftError] = useState<string | null>(null)
  const [badRow, setBadRow] = useState<number | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Move focus to the step heading whenever the step changes (not on first mount).
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) headingRef.current?.focus()
    else mounted.current = true
  }, [step])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }))

  const amenitySet = useMemo(() => new Set(draft.amenities), [draft.amenities])

  function focusFirstBadField(found: FieldErrors<keyof LibraryInput>, fields: (keyof LibraryInput)[]): boolean {
    const firstKey = fields.find((k) => found[k])
    if (!firstKey) return false
    const el = formRef.current?.querySelector<HTMLElement>(
      `[data-field="${firstKey}"] input, [data-field="${firstKey}"] select, [data-field="${firstKey}"] textarea`,
    )
    el?.focus()
    return true
  }

  // Validate the current step. Returns true if it's clean.
  function validateStep(current: number): boolean {
    const input = toInput(draft)
    if (current === 0) {
      const all = validateLibraryInput(input)
      const found: FieldErrors<keyof LibraryInput> = {}
      for (const k of STEP_FIELDS[0]) if (all[k]) found[k] = all[k]
      setErrors((e) => ({ ...e, ...found, ...clear(STEP_FIELDS[0], found) }))
      return !focusFirstBadField(found, STEP_FIELDS[0])
    }
    if (current === 1) {
      const all = validateLibraryInput(input)
      const found: FieldErrors<keyof LibraryInput> = {}
      for (const k of STEP_FIELDS[1]) if (all[k]) found[k] = all[k]
      setErrors((e) => ({ ...e, ...found, ...clear(STEP_FIELDS[1], found) }))
      if (focusFirstBadField(found, STEP_FIELDS[1])) return false
      // Validate shift rows.
      const shiftInputs = draftsToShiftInputs(shiftDrafts)
      const setProblem = validateShiftSet(shiftInputs)
      if (setProblem) {
        const idx = shiftInputs.findIndex((s) => validateShiftFields(s) !== null)
        setBadRow(idx >= 0 ? idx : null)
        setShiftError(setProblem)
        return false
      }
      setShiftError(null)
      setBadRow(null)
      return true
    }
    return true
  }

  // Produce "cleared" entries for fields that are now valid, so stale errors disappear.
  function clear(fields: (keyof LibraryInput)[], found: FieldErrors<keyof LibraryInput>) {
    const out: FieldErrors<keyof LibraryInput> = {}
    for (const k of fields) if (!found[k]) out[k] = undefined
    return out
  }

  function goNext() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, 2))
  }
  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Re-validate every step before the final submit.
    if (!validateStep(0)) {
      setStep(0)
      return
    }
    if (!validateStep(1)) {
      setStep(1)
      return
    }
    onSubmit(toInput(draft), draftsToShiftInputs(shiftDrafts))
  }

  const stepStates: StepState[] = [0, 1, 2].map((i) =>
    i < step ? 'done' : i === step ? 'current' : 'todo',
  )

  const cityById = useMemo(() => new Map(cities.map((c) => [c.id, c.name])), [cities])
  const areaById = useMemo(() => new Map(areas.map((a) => [a.id, a.name])), [areas])

  return (
    <form ref={formRef} noValidate onSubmit={handleSubmit}>
      <Steps
        className="mb-6"
        steps={STEP_LABELS.map((label, i) => ({ label, state: stepStates[i] }))}
      />

      <Card className="p-5 pb-24 sm:p-6 sm:pb-6">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">
          {STEP_TITLES[step]}
        </h2>

        {error && (
          <p role="alert" className="mt-4 rounded-control bg-danger-soft px-3 py-2 text-sm font-medium text-danger-ink">
            {error}
          </p>
        )}

        {/* Step 1: Your library */}
        <div hidden={step !== 0} className="mt-5 space-y-5">
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
              onPaste={(e) => {
                const pasted = e.clipboardData.getData('text')
                const digits = normalizePhone(pasted)
                if (digits) {
                  e.preventDefault()
                  set('phone', digits.slice(0, 10))
                }
              }}
              error={errors.phone}
            />
          </div>
        </div>

        {/* Step 2: Seats and shifts */}
        <div hidden={step !== 1} className="mt-5 space-y-5">
          <div data-field="capacity">
            <TextField
              label="Number of seats"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              hint="How many study seats does your library have?"
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
          <p className="rounded-control bg-primary-soft px-3 py-2 text-sm text-primary-ink">
            Shifts split the day so one seat can be rented more than once. For example, a morning
            shift at ₹800 and an evening shift at ₹600.
          </p>
          <NewShiftsField
            drafts={shiftDrafts}
            onChange={setShiftDrafts}
            error={shiftError}
            badRow={badRow}
          />
        </div>

        {/* Step 3: Photos and extras + review */}
        <div hidden={step !== 2} className="mt-5 space-y-6">
          <section className="space-y-3">
            <h3 className="font-semibold">Amenities (optional)</h3>
            <p className="text-sm text-ink-muted">Pick everything your library offers.</p>
            <div className="flex flex-wrap gap-2">
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
          </section>

          <section>
            <PhotoPicker photos={draft.photos} onChange={(p) => set('photos', p)} />
          </section>

          <section className="space-y-3 rounded-card border border-border bg-canvas/50 p-4">
            <h3 className="font-semibold">Review before you submit</h3>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Library" value={draft.name || '—'} />
              <Row
                label="Where"
                value={[areaById.get(draft.areaId), cityById.get(draft.cityId)].filter(Boolean).join(', ') || '—'}
              />
              <Row label="Seats" value={draft.capacity || '—'} />
              <Row label="Phone" value={draft.phone ? formatPhone(draft.phone) : '—'} />
              <Row
                label="Shifts"
                value={draftsToShiftInputs(shiftDrafts)
                  .map((s) => `${s.name} ${formatRupees(s.monthlyFeePaise)}`)
                  .join(' · ')}
              />
              <Row label="Photos" value={draft.photos.length ? `${draft.photos.length} added` : 'None'} />
            </dl>
          </section>
        </div>
      </Card>

      {/* Action bar: sticky above the safe area on phones, static below the card on desktop. */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:static sm:z-auto sm:mt-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none"
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          {step > 0 ? (
            <Button variant="secondary" onClick={goBack} className="min-h-11">
              Back
            </Button>
          ) : (
            <span className="min-h-11" />
          )}
          {step < 2 ? (
            // Distinct keys: without them React reuses one <button> and flips it to type=submit mid-click,
            // which submits the form on the second Continue and skips the review step.
            <Button key="next" onClick={goNext} className="min-h-11">
              Continue
            </Button>
          ) : (
            <Button key="submit" type="submit" loading={submitting} className="min-h-11">
              Submit for review
            </Button>
          )}
        </div>
      </div>
    </form>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  )
}
