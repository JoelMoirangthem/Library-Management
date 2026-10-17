import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ListFilter, Search, X } from 'lucide-react'
import { buttonStyles } from '@/components/Button'
import { CardGrid, GridItem } from '@/components/CardGrid'
import { SelectField } from '@/components/Fields'
import { PageHeader } from '@/components/PageParts'
import { FilterSheet } from '@/components/student/FilterSheet'
import { LibraryCard, LibraryCardSkeleton } from '@/components/student/LibraryCard'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { FEE_OPTIONS, feeOptionLabel } from '@/components/student/discoverOptions'
import type { PublicLibrary } from '@/domain/types'
import { services } from '@/lib/container'
import { useAsync } from '@/hooks/useAsync'
import { useTitle } from '@/hooks/useTitle'

type SortKey = 'seats' | 'fee'

/** Free seats across all active shifts, used for the 'Most seats free' sort. */
function totalSeatsFree(lib: PublicLibrary): number {
  return lib.shifts.reduce((sum, s) => sum + s.seatsLeft, 0)
}

export default function Discover() {
  useTitle('Find a library')
  const [params, setParams] = useSearchParams()

  const cityId = params.get('city') ?? ''
  const areaId = params.get('area') ?? ''
  const maxFee = params.get('maxFee') ?? ''
  const q = params.get('q') ?? ''
  const sort = (params.get('sort') as SortKey) || 'seats'
  const sheetOpen = params.get('filters') === '1'
  const amenities = useMemo(() => params.getAll('amenity'), [params])

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

  const cityName = cities.data?.find((c) => c.id === cityId)?.name
  const areaName = areas.data?.find((a) => a.id === areaId)?.name

  /** Write the whole next query string at once so related changes stay in sync. */
  function update(next: {
    city?: string
    area?: string
    maxFee?: string
    amenities?: string[]
    q?: string
    sort?: SortKey
    filters?: boolean
  }) {
    const nextCity = next.city ?? cityId
    // Changing city clears the area selection.
    const nextArea = next.city !== undefined ? '' : (next.area ?? areaId)
    const nextFee = next.maxFee ?? maxFee
    const nextAmenities = next.amenities ?? amenities
    const nextQ = next.q ?? q
    const nextSort = next.sort ?? sort
    const nextFilters = next.filters ?? sheetOpen

    const sp = new URLSearchParams()
    if (nextQ) sp.set('q', nextQ)
    if (nextCity) sp.set('city', nextCity)
    if (nextArea) sp.set('area', nextArea)
    if (nextFee) sp.set('maxFee', nextFee)
    for (const a of nextAmenities) sp.append('amenity', a)
    if (nextSort !== 'seats') sp.set('sort', nextSort)
    if (nextFilters) sp.set('filters', '1')
    setParams(sp, { replace: true })
  }

  function clearAll() {
    setParams(new URLSearchParams(), { replace: true })
  }

  // Filters the sheet counts and the chips below the search (city/area live in the top row).
  const sheetFilterCount = (maxFee ? 1 : 0) + amenities.length
  const activeChips: { key: string; label: string; onRemove: () => void }[] = []
  if (cityName) activeChips.push({ key: 'city', label: cityName, onRemove: () => update({ city: '' }) })
  if (areaName) activeChips.push({ key: 'area', label: areaName, onRemove: () => update({ area: '' }) })
  if (maxFee)
    activeChips.push({ key: 'maxFee', label: feeOptionLabel(maxFee), onRemove: () => update({ maxFee: '' }) })
  for (const a of amenities)
    activeChips.push({
      key: `amenity-${a}`,
      label: a,
      onRemove: () => update({ amenities: amenities.filter((x) => x !== a) }),
    })

  // Server returns the city/area/fee/amenity matches; name/area/landmark search is applied here.
  const searched = useMemo(() => {
    const list = results.data ?? []
    const needle = q.trim().toLowerCase()
    const filtered = needle
      ? list.filter((lib) =>
          [lib.name, lib.areaName, lib.landmark].some((f) => f.toLowerCase().includes(needle)),
        )
      : list
    const sorted = [...filtered].sort((a, b) =>
      sort === 'fee' ? a.fromFeePaise - b.fromFeePaise : totalSeatsFree(b) - totalSeatsFree(a),
    )
    return sorted
  }, [results.data, q, sort])

  const count = searched.length
  const hasAnyFilter = Boolean(cityId || areaId || maxFee || q || amenities.length)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Find a study library"
        description="Search, then pick your city and area to see libraries with a free seat near you."
      />

      <section aria-label="Search and filters" className="mb-6 space-y-4">
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
          />
          <label htmlFor="library-search" className="sr-only">
            Search by library name
          </label>
          <input
            id="library-search"
            type="search"
            value={q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="Search by library name"
            className="block w-full min-h-11 rounded-control border border-border-strong bg-surface py-2 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/70"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <SelectField label="City" value={cityId} onChange={(e) => update({ city: e.target.value })}>
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

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => update({ filters: true })}
              className={buttonStyles('secondary', 'w-full sm:w-auto')}
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
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-canvas"
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
            description="Try a different city or area, or relax your filters."
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
                  className="min-h-11 max-w-full cursor-pointer rounded-control border border-border-strong bg-surface px-3 text-base text-ink"
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
