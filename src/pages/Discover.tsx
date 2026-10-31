import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ListFilter, Search, X } from 'lucide-react'
import { buttonStyles } from '@/components/Button'
import { CardGrid, GridItem } from '@/components/CardGrid'
import { PageHeader } from '@/components/PageParts'
import { PlaceFields } from '@/components/PlaceFields'
import { FilterSheet } from '@/components/student/FilterSheet'
import { LibraryCard, LibraryCardSkeleton } from '@/components/student/LibraryCard'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { FEE_OPTIONS, feeOptionLabel } from '@/components/student/discoverOptions'
import { matchesLibrarySearch } from '@/domain/librarySearch'
import type { PublicLibrary } from '@/domain/types'
import { services } from '@/lib/container'
import { useAsync } from '@/hooks/useAsync'
import { changePlace, chosenPlaceNames, usePlaceOptions, type PlaceValue } from '@/hooks/usePlaceOptions'
import { useTitle } from '@/hooks/useTitle'

type SortKey = 'seats' | 'fee'

/** Free seats across all active shifts, used for the 'Most seats free' sort. */
function totalSeatsFree(lib: PublicLibrary): number {
  return lib.shifts.reduce((sum, s) => sum + s.seatsLeft, 0)
}

export default function Discover() {
  useTitle('Find a library')
  const [params, setParams] = useSearchParams()

  const place: PlaceValue = {
    stateId: params.get('state') ?? '',
    districtId: params.get('district') ?? '',
    cityId: params.get('city') ?? '',
    area: params.get('area') ?? '',
  }
  const maxFee = params.get('maxFee') ?? ''
  const q = params.get('q') ?? ''
  const sort = (params.get('sort') as SortKey) || 'seats'
  const sheetOpen = params.get('filters') === '1'
  const amenities = useMemo(() => params.getAll('amenity'), [params])

  // Each list loads only after its parent is picked: a state's districts, then a district's towns, then the town's area names.
  const places = usePlaceOptions(place, { areaNames: true })

  const results = useAsync(
    () =>
      services.searchLibraries({
        stateId: place.stateId || undefined,
        districtId: place.districtId || undefined,
        cityId: place.cityId || undefined,
        area: place.area || undefined,
        maxFeePaise: maxFee ? Number(maxFee) : undefined,
        amenities: amenities.length ? amenities : undefined,
      }),
    [place.stateId, place.districtId, place.cityId, place.area, maxFee, amenities.join(',')],
  )

  const names = chosenPlaceNames(place, places)

  /** Write the whole next query string at once so related changes stay in sync. */
  function update(next: {
    place?: PlaceValue
    maxFee?: string
    amenities?: string[]
    q?: string
    sort?: SortKey
    filters?: boolean
  }) {
    const nextPlace = next.place ?? place
    const nextFee = next.maxFee ?? maxFee
    const nextAmenities = next.amenities ?? amenities
    const nextQ = next.q ?? q
    const nextSort = next.sort ?? sort
    const nextFilters = next.filters ?? sheetOpen

    const sp = new URLSearchParams()
    if (nextQ) sp.set('q', nextQ)
    if (nextPlace.stateId) sp.set('state', nextPlace.stateId)
    if (nextPlace.districtId) sp.set('district', nextPlace.districtId)
    if (nextPlace.cityId) sp.set('city', nextPlace.cityId)
    if (nextPlace.area) sp.set('area', nextPlace.area)
    if (nextFee) sp.set('maxFee', nextFee)
    for (const a of nextAmenities) sp.append('amenity', a)
    if (nextSort !== 'seats') sp.set('sort', nextSort)
    if (nextFilters) sp.set('filters', '1')
    setParams(sp, { replace: true })
  }

  function clearAll() {
    setParams(new URLSearchParams(), { replace: true })
  }

  // Filters the sheet counts and the chips below the search (places live in the top row).
  const sheetFilterCount = (maxFee ? 1 : 0) + amenities.length
  const activeChips: { key: string; label: string; onRemove: () => void }[] = []
  const placeChips: [keyof PlaceValue, string][] = [
    ['stateId', names.stateName],
    ['districtId', names.districtName],
    ['cityId', names.cityName],
    ['area', names.areaName],
  ]
  for (const [key, label] of placeChips) {
    // Removing a place also removes the smaller places inside it.
    if (label) activeChips.push({ key, label, onRemove: () => update({ place: changePlace(place, key, '') }) })
  }
  if (maxFee)
    activeChips.push({ key: 'maxFee', label: feeOptionLabel(maxFee), onRemove: () => update({ maxFee: '' }) })
  for (const a of amenities)
    activeChips.push({
      key: `amenity-${a}`,
      label: a,
      onRemove: () => update({ amenities: amenities.filter((x) => x !== a) }),
    })

  // The server returns the place/fee/amenity matches; the typed words are matched here (name, places, landmark, address, pincode).
  const searched = useMemo(() => {
    const list = results.data ?? []
    const filtered = list.filter((lib) => matchesLibrarySearch(lib, q))
    const sorted = [...filtered].sort((a, b) =>
      sort === 'fee' ? a.fromFeePaise - b.fromFeePaise : totalSeatsFree(b) - totalSeatsFree(a),
    )
    return sorted
  }, [results.data, q, sort])

  const count = searched.length
  const hasAnyFilter = Boolean(place.stateId || maxFee || q || amenities.length)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Find a study library"
        description="Search, then pick your state, district and town to see libraries with a free seat near you."
      />

      <section aria-label="Search and filters" className="mb-6 space-y-3">
        {/* Search and Filters share one row so the results start higher on a phone. */}
        <div className="flex items-stretch gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
            />
            <label htmlFor="library-search" className="sr-only">
              Search libraries by name, area, city or pincode
            </label>
            <input
              id="library-search"
              type="search"
              value={q}
              onChange={(e) => update({ q: e.target.value })}
              placeholder="Name, area or city"
              autoComplete="off"
              enterKeyHint="search"
              className="block w-full min-h-11 pointer-fine:min-h-9 rounded-control border border-border-strong bg-surface py-2 pl-10 pr-3 text-base pointer-fine:text-sm text-ink placeholder:text-ink-muted/70"
            />
          </div>
          <button
            type="button"
            onClick={() => update({ filters: true })}
            className={buttonStyles('secondary', 'shrink-0 px-3 sm:px-4')}
            aria-haspopup="dialog"
          >
            <ListFilter aria-hidden className="size-4" />
            Filters
            {sheetFilterCount > 0 && (
              <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-white">
                {sheetFilterCount}
              </span>
            )}
          </button>
        </div>

        <PlaceFields
          mode="filter"
          value={place}
          options={places}
          onChange={(p) => update({ place: p })}
          className="grid-cols-2 lg:grid-cols-4"
        />
        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                className="inline-flex min-h-11 pointer-fine:min-h-9 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-canvas"
              >
                {chip.label}
                <X aria-hidden className="size-4 text-ink-muted" />
                <span className="sr-only">Remove filter</span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      <section aria-label="Results" aria-busy={results.refreshing || undefined}>
        {results.loading ? (
          <CardGrid count={6} aria-busy="true" aria-label="Finding libraries">
            {Array.from({ length: 6 }, (_, i) => (
              <GridItem key={i}>
                <LibraryCardSkeleton />
              </GridItem>
            ))}
          </CardGrid>
        ) : results.error ? (
          <ErrorState onRetry={results.reload} retrying={results.refreshing} />
        ) : count === 0 ? (
          <EmptyState
            title="No libraries match"
            description="Try a different place, or relax your filters."
            action={
              hasAnyFilter ? (
                <button type="button" onClick={clearAll} className={buttonStyles('secondary')}>
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
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted tabular-nums" aria-live="polite">
                {count} {count === 1 ? 'library' : 'libraries'}
              </p>
              <label className="flex min-w-0 max-w-full items-center gap-2 text-sm text-ink-muted">
                Sort
                <select
                  value={sort}
                  onChange={(e) => update({ sort: e.target.value as SortKey })}
                  className="min-h-11 pointer-fine:min-h-9 max-w-full cursor-pointer rounded-control border border-border-strong bg-surface px-3 text-base pointer-fine:text-sm text-ink"
                >
                  <option value="seats">Most seats free</option>
                  <option value="fee">Lowest fee</option>
                </select>
              </label>
            </div>
            <CardGrid count={count}>
              {searched.map((lib) => (
                <GridItem key={lib.id}>
                  <LibraryCard library={lib} />
                </GridItem>
              ))}
            </CardGrid>
          </>
        )}
      </section>

      <FilterSheet
        open={sheetOpen}
        onClose={() => update({ filters: false })}
        maxFee={maxFee}
        amenities={amenities}
        feeOptions={FEE_OPTIONS}
        resultCount={count}
        onChangeMaxFee={(v) => update({ maxFee: v })}
        onToggleAmenity={(name, on) =>
          update({ amenities: on ? [...amenities, name] : amenities.filter((a) => a !== name) })
        }
        onClear={() => update({ maxFee: '', amenities: [] })}
      />
    </div>
  )
}
