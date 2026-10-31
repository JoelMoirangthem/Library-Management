import { useMemo, useState, type FormEvent } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageHeader } from '@/components/PageParts'
import { SelectField, TextField } from '@/components/Fields'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { Switch } from '@/components/admin/AdminBits'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { changePlace, NO_PLACE, usePlaceOptions, type PlaceValue } from '@/hooks/usePlaceOptions'
import { useTitle } from '@/hooks/useTitle'
import { services } from '@/lib/container'
import { cx } from '@/lib/cx'
import type { Area, City } from '@/domain/types'

/**
 * States and districts come from the government's list and cannot be changed here. An admin picks a district, sees
 * all its towns, adds a town the list is missing, adds areas inside a town, and switches towns or areas off.
 */
export default function Places() {
  useTitle('Places')
  const [sel, setSel] = useState<PlaceValue>(NO_PLACE)
  const places = usePlaceOptions(sel, { includeInactive: true })
  // Areas are few (admins type them in), so all are loaded once for the counts next to each town.
  const allAreas = useAsync(() => services.listAreas({ includeInactive: true }), [])

  const areaCountByCity = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of allAreas.data ?? []) map.set(a.cityId, (map.get(a.cityId) ?? 0) + 1)
    return map
  }, [allAreas.data])

  const district = places.districts.items.find((d) => d.id === sel.districtId) ?? null
  const town = places.cities.items.find((c) => c.id === sel.cityId) ?? null
  const towns = places.cities
  const areas = places.areas

  return (
    <>
      <PageHeader
        title="Places"
        description="States and districts come from the government's list. Add a town that is missing, or switch one off to hide it from search. Areas added here show up in the students' area filter."
      />

      {places.states.error ? (
        <ErrorState onRetry={places.states.reload} />
      ) : (
        <>
          <Card className="mb-6 grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <SelectField
              label="State"
              value={sel.stateId}
              disabled={places.states.loading}
              onChange={(e) => setSel(changePlace(sel, 'stateId', e.target.value))}
            >
              <option value="">{places.states.loading ? 'Loading…' : 'Choose a state'}</option>
              {places.states.items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="District"
              value={sel.districtId}
              disabled={!sel.stateId || places.districts.loading}
              hint={!sel.stateId ? 'Choose a state first.' : undefined}
              onChange={(e) => setSel(changePlace(sel, 'districtId', e.target.value))}
            >
              <option value="">{places.districts.loading ? 'Loading…' : 'Choose a district'}</option>
              {places.districts.items.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </SelectField>
          </Card>

          <div className="grid items-stretch gap-6 lg:grid-cols-2">
            {/* Towns pane */}
            <section aria-labelledby="towns-heading" className="flex min-w-0 flex-col">
              <Card className="flex min-h-full flex-1 flex-col p-4 sm:p-5">
                <h2 id="towns-heading" className="text-lg font-semibold">
                  {district ? `Towns in ${district.name}` : 'Towns'}
                </h2>
                {!district ? (
                  <div className="mt-3 flex-1">
                    <EmptyState title="Pick a district" description="Choose a state and a district to see its towns." />
                  </div>
                ) : (
                  <>
                    <div className="mt-3">
                      <AddTownForm districtId={district.id} />
                    </div>
                    <div className="mt-3 max-h-[28rem] flex-1 overflow-y-auto">
                      {towns.loading ? (
                        <LoadingState layout="list" label="Loading towns" />
                      ) : towns.error ? (
                        <ErrorState onRetry={towns.reload} />
                      ) : towns.items.length === 0 ? (
                        <EmptyState title="No towns yet" description={`Add the first town in ${district.name}.`} />
                      ) : (
                        <ul className="divide-y divide-border rounded-card border border-border">
                          {towns.items.map((c) => (
                            <li key={c.id}>
                              <TownRow
                                town={c}
                                areaCount={areaCountByCity.get(c.id) ?? 0}
                                selected={c.id === sel.cityId}
                                onSelect={() => setSel(changePlace(sel, 'cityId', c.id))}
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </Card>
            </section>

            {/* Areas pane: on phones this appears below after a town is picked */}
            <section aria-labelledby="areas-heading" className={cx('flex min-w-0 flex-col', !town && 'hidden lg:flex')}>
              <Card className="flex min-h-full flex-1 flex-col p-4 sm:p-5">
                <h2 id="areas-heading" className="text-lg font-semibold">
                  {town ? `Areas in ${town.name}` : 'Areas'}
                </h2>
                {!town ? (
                  <div className="mt-3 flex-1">
                    <EmptyState title="Pick a town" description="Select a town to see and add areas for the students' area filter." />
                  </div>
                ) : (
                  <>
                    <div className="mt-3">
                      <AddAreaForm cityId={town.id} />
                    </div>
                    <div className="mt-3 max-h-[28rem] flex-1 overflow-y-auto">
                      {areas.loading ? (
                        <LoadingState layout="list" label="Loading areas" />
                      ) : areas.error ? (
                        <ErrorState onRetry={areas.reload} />
                      ) : areas.items.length === 0 ? (
                        <EmptyState title="No areas yet" description={`Add the first area in ${town.name}.`} />
                      ) : (
                        <ul className="divide-y divide-border rounded-card border border-border">
                          {areas.items.map((area) => (
                            <li key={area.id}>
                              <AreaRow area={area} />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                )}
              </Card>
            </section>
          </div>
        </>
      )}
    </>
  )
}

function TownRow({
  town,
  areaCount,
  selected,
  onSelect,
}: {
  town: City
  areaCount: number
  selected: boolean
  onSelect: () => void
}) {
  const { run } = useMutation(services.setCityActive)
  return (
    <div
      className={cx(
        'flex min-h-11 flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3',
        selected && 'bg-primary-soft/40',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
      >
        <span className={cx('min-w-0 break-words font-medium', !town.isActive && 'text-ink-muted')}>{town.name}</span>
        {!town.isActive && <Badge tone="neutral">Off</Badge>}
        <span className="ml-auto whitespace-nowrap text-sm tabular-nums text-ink-muted">
          {areaCount} {areaCount === 1 ? 'area' : 'areas'}
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
      </button>
      <div className="shrink-0">
        <Switch label="Active" checked={town.isActive} onChange={(on) => void run(town.id, on)} />
      </div>
    </div>
  )
}

function AreaRow({ area }: { area: Area }) {
  const { run } = useMutation(services.setAreaActive)
  return (
    <div className="flex min-h-11 flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
      <span className="flex min-w-0 items-center gap-2">
        <span className={cx('min-w-0 break-words', !area.isActive && 'text-ink-muted')}>{area.name}</span>
        {!area.isActive && <Badge tone="neutral">Off</Badge>}
      </span>
      <div className="shrink-0">
        <Switch label="Active" checked={area.isActive} onChange={(on) => void run(area.id, on)} />
      </div>
    </div>
  )
}

function AddTownForm({ districtId }: { districtId: string }) {
  const [name, setName] = useState('')
  const { run, loading, error, clearError } = useMutation(services.addCity, {
    success: 'Town added',
    silent: true,
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const ok = await run(districtId, trimmed)
    if (ok !== undefined) setName('')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <TextField
        label="Add a missing town"
        className="flex-1"
        placeholder="e.g. Malihabad"
        value={name}
        error={error?.message}
        onChange={(e) => {
          setName(e.target.value)
          if (error) clearError()
        }}
      />
      <Button type="submit" variant="secondary" loading={loading} className="px-3 sm:mt-7" aria-label="Add town">
        <Plus aria-hidden className="size-4" />
        Add
      </Button>
    </form>
  )
}

function AddAreaForm({ cityId }: { cityId: string }) {
  const [name, setName] = useState('')
  const { run, loading, error, clearError } = useMutation(services.addArea, {
    success: 'Area added',
    silent: true,
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const ok = await run(cityId, trimmed)
    if (ok !== undefined) setName('')
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <TextField
        label="Add area"
        className="flex-1"
        placeholder="e.g. Vaishali Nagar"
        value={name}
        error={error?.message}
        onChange={(e) => {
          setName(e.target.value)
          if (error) clearError()
        }}
      />
      <Button type="submit" variant="secondary" loading={loading} className="px-3 sm:mt-7" aria-label="Add area">
        <Plus aria-hidden className="size-4" />
        Add
      </Button>
    </form>
  )
}
