import { useMemo, useState, type FormEvent } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { PageHeader } from '@/components/PageParts'
import { TextField } from '@/components/Fields'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { Switch } from '@/components/admin/AdminBits'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { services } from '@/lib/container'
import { cx } from '@/lib/cx'
import type { Area, City } from '@/domain/types'

export default function Places() {
  const cities = useAsync(() => services.listCities({ includeInactive: true }), [])
  const areas = useAsync(() => services.listAreas({ includeInactive: true }), [])

  const [selectedCityId, setSelectedCityId] = useState<string | null>(null)

  const loading = cities.loading || areas.loading
  const error = cities.error ?? areas.error

  const cityList = cities.data ?? []
  const areaList = useMemo(() => areas.data ?? [], [areas.data])

  const areaCountByCity = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of areaList) map.set(a.cityId, (map.get(a.cityId) ?? 0) + 1)
    return map
  }, [areaList])

  const selectedCity = cityList.find((c) => c.id === selectedCityId) ?? null
  const cityAreas = selectedCity ? areaList.filter((a) => a.cityId === selectedCity.id) : []

  return (
    <>
      <PageHeader title="Cities and areas" description="Students search within active cities and areas." />

      {loading ? (
        <LoadingState layout="list" label="Loading places" />
      ) : error ? (
        <ErrorState onRetry={() => { cities.reload(); areas.reload() }} />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Cities pane */}
          <section aria-labelledby="cities-heading" className="space-y-3">
            <h2 id="cities-heading" className="text-lg font-semibold">
              Cities
            </h2>
            <AddCityForm />
            {cityList.length === 0 ? (
              <EmptyState title="No cities yet" description="Add your first city above." />
            ) : (
              <Card className="divide-y divide-border">
                {cityList.map((city) => (
                  <CityRow
                    key={city.id}
                    city={city}
                    areaCount={areaCountByCity.get(city.id) ?? 0}
                    selected={city.id === selectedCityId}
                    onSelect={() => setSelectedCityId(city.id)}
                  />
                ))}
              </Card>
            )}
          </section>

          {/* Areas pane: on phones this appears below after a city is picked */}
          <section
            aria-labelledby="areas-heading"
            className={cx('space-y-3', !selectedCity && 'hidden md:block')}
          >
            <h2 id="areas-heading" className="text-lg font-semibold">
              {selectedCity ? `Areas in ${selectedCity.name}` : 'Areas'}
            </h2>
            {!selectedCity ? (
              <EmptyState title="Pick a city" description="Select a city to see and add its areas." />
            ) : (
              <>
                <AddAreaForm cityId={selectedCity.id} />
                {cityAreas.length === 0 ? (
                  <EmptyState title="No areas yet" description={`Add the first area in ${selectedCity.name}.`} />
                ) : (
                  <Card className="divide-y divide-border">
                    {cityAreas.map((area) => (
                      <AreaRow key={area.id} area={area} />
                    ))}
                  </Card>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}

function CityRow({
  city,
  areaCount,
  selected,
  onSelect,
}: {
  city: City
  areaCount: number
  selected: boolean
  onSelect: () => void
}) {
  const { run } = useMutation(services.setCityActive)
  return (
    <div className={cx('flex items-center gap-3 p-3', selected && 'bg-primary-soft/40')}>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left">
        <span className={cx('truncate font-medium', !city.isActive && 'text-ink-muted')}>{city.name}</span>
        {!city.isActive && <Badge tone="neutral">Inactive</Badge>}
        <span className="ml-auto whitespace-nowrap text-sm tabular-nums text-ink-muted">
          {areaCount} {areaCount === 1 ? 'area' : 'areas'}
        </span>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-muted" />
      </button>
      <Switch
        label="Active"
        checked={city.isActive}
        onChange={(on) => void run(city.id, on)}
      />
    </div>
  )
}

function AreaRow({ area }: { area: Area }) {
  const { run } = useMutation(services.setAreaActive)
  return (
    <div className="flex items-center justify-between gap-3 p-3">
      <span className="flex min-w-0 items-center gap-2">
        <span className={cx('truncate', !area.isActive && 'text-ink-muted')}>{area.name}</span>
        {!area.isActive && <Badge tone="neutral">Inactive</Badge>}
      </span>
      <Switch label="Active" checked={area.isActive} onChange={(on) => void run(area.id, on)} />
    </div>
  )
}

function AddCityForm() {
  const [name, setName] = useState('')
  const { run, loading, error, clearError } = useMutation(services.addCity, {
    success: 'City added',
    silent: true,
  })

  async function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const ok = await run(trimmed)
    if (ok !== undefined) setName('')
  }

  return (
    <form onSubmit={submit} className="flex items-start gap-2">
      <TextField
        label="Add city"
        className="flex-1"
        placeholder="e.g. Jaipur"
        value={name}
        error={error?.message}
        onChange={(e) => {
          setName(e.target.value)
          if (error) clearError()
        }}
      />
      <Button type="submit" variant="secondary" loading={loading} className="mt-7 px-3" aria-label="Add city">
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
    <form onSubmit={submit} className="flex items-start gap-2">
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
      <Button type="submit" variant="secondary" loading={loading} className="mt-7 px-3" aria-label="Add area">
        <Plus aria-hidden className="size-4" />
        Add
      </Button>
    </form>
  )
}
