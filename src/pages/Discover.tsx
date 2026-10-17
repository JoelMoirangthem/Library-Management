import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buttonStyles } from '@/components/Button'
import { ChipCheckbox, SelectField } from '@/components/Fields'
import { PageHeader } from '@/components/PageParts'
import { LibraryCard } from '@/components/student/LibraryCard'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { AMENITIES } from '@/domain/constants'
import { services } from '@/lib/container'
import { useAsync } from '@/hooks/useAsync'

/** Fee options in paise. "Any" is the empty value. */
const FEE_OPTIONS = [
  { value: '80000', label: 'Up to ₹800' },
  { value: '100000', label: 'Up to ₹1,000' },
  { value: '120000', label: 'Up to ₹1,200' },
  { value: '150000', label: 'Up to ₹1,500' },
] as const

export default function Discover() {
  const [params, setParams] = useSearchParams()

  const cityId = params.get('city') ?? ''
  const areaId = params.get('area') ?? ''
  const maxFee = params.get('maxFee') ?? ''
  const amenities = useMemo(() => params.getAll('amenity'), [params])

  const hasFilters = Boolean(cityId || areaId || maxFee || amenities.length)

  const cities = useAsync(() => services.listCities(), [])
  // Areas depend on the chosen city; skip the call entirely when no city is picked.
  const areas = useAsync(
    () => (cityId ? services.listAreas({ cityId }) : Promise.resolve([])),
    [cityId],
  )

  const results = useAsync(
    () =>
      services.searchLibraries({
        cityId: cityId || undefined,
        areaId: areaId || undefined,
        maxFeePaise: maxFee ? Number(maxFee) : undefined,
        amenities: amenities.length ? amenities : undefined,
      }),
    [cityId, areaId, maxFee, amenities.join(',')],
  )

  /** Write the whole next query string at once so related changes stay in sync. */
  function update(next: {
    city?: string
    area?: string
    maxFee?: string
    amenities?: string[]
  }) {
    const nextCity = next.city ?? cityId
    // Changing city clears the area selection.
    const nextArea = next.city !== undefined ? '' : (next.area ?? areaId)
    const nextFee = next.maxFee ?? maxFee
    const nextAmenities = next.amenities ?? amenities

    const sp = new URLSearchParams()
    if (nextCity) sp.set('city', nextCity)
    if (nextArea) sp.set('area', nextArea)
    if (nextFee) sp.set('maxFee', nextFee)
    for (const a of nextAmenities) sp.append('amenity', a)
    setParams(sp, { replace: true })
  }

  function toggleAmenity(name: string, on: boolean) {
    update({ amenities: on ? [...amenities, name] : amenities.filter((a) => a !== name) })
  }

  function clearFilters() {
    setParams(new URLSearchParams(), { replace: true })
  }

  const count = results.data?.length ?? 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Find a study library"
        description="Pick your city and area to see libraries with a free seat near you."
      />

      <section aria-label="Filters" className="mb-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label="City"
            value={cityId}
            onChange={(e) => update({ city: e.target.value })}
          >
            <option value="">All cities</option>
            {cities.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Area"
            value={areaId}
            disabled={!cityId}
            hint={!cityId ? 'Choose a city first' : undefined}
            onChange={(e) => update({ area: e.target.value })}
          >
            <option value="">All areas</option>
            {areas.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Max monthly fee"
            value={maxFee}
            onChange={(e) => update({ maxFee: e.target.value })}
          >
            <option value="">Any</option>
            {FEE_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </SelectField>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Amenities</legend>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <ChipCheckbox
                key={a}
                label={a}
                checked={amenities.includes(a)}
                onChange={(on) => toggleAmenity(a, on)}
              />
            ))}
          </div>
        </fieldset>
      </section>

      <section aria-label="Results" aria-busy={results.refreshing || undefined}>
        {results.loading ? (
          <LoadingState layout="cards" label="Finding libraries" count={6} />
        ) : results.error ? (
          <ErrorState onRetry={results.reload} retrying={results.refreshing} />
        ) : count === 0 ? (
          <EmptyState
            title="No libraries match"
            description="Try a different city or area, or relax your filters."
            action={
              hasFilters ? (
                <button type="button" onClick={clearFilters} className={buttonStyles('secondary')}>
                  Clear filters
                </button>
              ) : (
                <Link to="/" className={buttonStyles('secondary')}>
                  Back to home
                </Link>
              )
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-ink-muted tabular-nums" aria-live="polite">
              {count} {count === 1 ? 'library' : 'libraries'}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.data?.map((lib) => (
                <li key={lib.id}>
                  <LibraryCard library={lib} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  )
}
