import { AreaField } from '@/components/AreaField'
import { SelectField } from '@/components/Fields'
import { sameArea } from '@/domain/areas'
import { changePlace, type PlaceList, type PlaceOptions, type PlaceValue } from '@/hooks/usePlaceOptions'
import { cx } from '@/lib/cx'

type ListKey = 'stateId' | 'districtId' | 'cityId'

const WORDS: Record<ListKey, { label: string; pick: string; all: string; first: string; list: string }> = {
  stateId: { label: 'State', pick: 'Choose a state', all: 'All states', first: '', list: 'states' },
  districtId: { label: 'District', pick: 'Choose a district', all: 'All districts', first: 'Choose a state first.', list: 'districts' },
  cityId: { label: 'City or town', pick: 'Choose a city or town', all: 'All cities and towns', first: 'Choose a district first.', list: 'cities and towns' },
}

type Props = {
  value: PlaceValue
  options: PlaceOptions
  onChange: (next: PlaceValue) => void
  /** form: the owner chooses state, district and town, then types the area (optional). filter: every level may stay "All". */
  mode: 'form' | 'filter'
  errors?: Partial<Record<keyof PlaceValue, string | undefined>>
  className?: string
}

/**
 * State, district and city or town as cascading dropdowns, then the area. Picking a state lists all its districts;
 * picking a district lists all its towns. Changing one clears the ones below it.
 * In a form the area is a text box the owner types in (D-045); in a search it is a dropdown of the area names in the town.
 * Each field sits in a `data-field` wrapper so a form can move focus to the first field with an error.
 */
export function PlaceFields({ value, options, onChange, mode, errors = {}, className }: Props) {
  const parent: Record<ListKey, string> = { stateId: 'all', districtId: value.stateId, cityId: value.districtId }

  function pick(key: keyof PlaceValue, id: string) {
    const next = changePlace(value, key, id)
    // An area the owner typed is not tied to the town list, so it stays when the state, district or town changes.
    onChange(mode === 'form' ? { ...next, area: value.area } : next)
  }

  function field(key: ListKey, list: PlaceList<{ id: string; name: string }>) {
    const w = WORDS[key]
    const hasParent = Boolean(parent[key])
    const loadError = hasParent && list.error ? `Could not load the ${w.list}. Check your connection and refresh the page.` : undefined
    return (
      <div data-field={key}>
        <SelectField
          label={w.label}
          value={value[key]}
          disabled={!hasParent || list.loading}
          hint={!hasParent ? w.first : undefined}
          error={errors[key] ?? loadError}
          onChange={(e) => pick(key, e.target.value)}
        >
          {list.loading ? (
            // Keep the chosen value selected while its list loads, so the page never flashes "Choose a state".
            <option value={value[key]}>Loading…</option>
          ) : (
            <>
              <option value="">{mode === 'filter' ? w.all : w.pick}</option>
              {list.items.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </>
          )}
        </SelectField>
      </div>
    )
  }

  /** Search: the area names students can filter by in the chosen town. */
  function areaFilter() {
    const list = options.areaNames
    const hasParent = Boolean(value.cityId)
    const noAreas = hasParent && !list.loading && !list.error && list.items.length === 0 && !value.area
    // Show the list's spelling for a matching area (a shared link may differ in case or spacing).
    const shown = list.items.find((n) => sameArea(n, value.area)) ?? value.area
    const loadError = hasParent && list.error ? 'Could not load the areas. Check your connection and refresh the page.' : undefined
    return (
      <div data-field="area">
        <SelectField
          label="Area"
          value={shown}
          disabled={!hasParent || list.loading || noAreas}
          hint={!hasParent ? 'Choose a city or town first.' : noAreas ? 'No areas are listed for this town yet.' : undefined}
          error={loadError}
          onChange={(e) => pick('area', e.target.value)}
        >
          {list.loading ? (
            <option value={value.area}>Loading…</option>
          ) : (
            <>
              <option value="">All areas</option>
              {value.area && !list.items.some((n) => sameArea(n, value.area)) && <option value={value.area}>{value.area}</option>}
              {list.items.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </>
          )}
        </SelectField>
      </div>
    )
  }

  return (
    <div className={cx('grid gap-x-3 gap-y-4 sm:grid-cols-2', className)}>
      {field('stateId', options.states)}
      {field('districtId', options.districts)}
      {field('cityId', options.cities)}
      {mode === 'form' ? (
        <div data-field="area">
          <AreaField value={value.area} error={errors.area} onChange={(area) => onChange({ ...value, area })} />
        </div>
      ) : (
        areaFilter()
      )}
    </div>
  )
}
