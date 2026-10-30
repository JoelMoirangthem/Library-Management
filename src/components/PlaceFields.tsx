import { SelectField } from '@/components/Fields'
import { changePlace, type PlaceList, type PlaceOptions, type PlaceValue } from '@/hooks/usePlaceOptions'
import { cx } from '@/lib/cx'

type Key = keyof PlaceValue

const WORDS: Record<Key, { label: string; pick: string; all: string; first: string; list: string }> = {
  stateId: { label: 'State', pick: 'Choose a state', all: 'All states', first: '', list: 'states' },
  districtId: { label: 'District', pick: 'Choose a district', all: 'All districts', first: 'Choose a state first.', list: 'districts' },
  cityId: { label: 'City or town', pick: 'Choose a city or town', all: 'All cities and towns', first: 'Choose a district first.', list: 'cities and towns' },
  areaId: { label: 'Area', pick: 'No area', all: 'All areas', first: 'Choose a city or town first.', list: 'areas' },
}

type Props = {
  value: PlaceValue
  options: PlaceOptions
  onChange: (next: PlaceValue) => void
  /** form: the owner must choose state, district and town; the area is optional. filter: every level may stay "All". */
  mode: 'form' | 'filter'
  errors?: Partial<Record<Key, string | undefined>>
  className?: string
}

/**
 * State, district, city or town, and area, as four cascading dropdowns. Picking a state lists all its districts;
 * picking a district lists all its towns. Changing one clears the ones below it.
 * Each field sits in a `data-field` wrapper so a form can move focus to the first field with an error.
 */
export function PlaceFields({ value, options, onChange, mode, errors = {}, className }: Props) {
  const parent: Record<Key, string> = { stateId: 'all', districtId: value.stateId, cityId: value.districtId, areaId: value.cityId }

  function field(key: Key, list: PlaceList<{ id: string; name: string }>) {
    const w = WORDS[key]
    const hasParent = Boolean(parent[key])
    const noAreas = key === 'areaId' && hasParent && !list.loading && !list.error && list.items.length === 0
    const loadError = hasParent && list.error ? `Could not load the ${w.list}. Check your connection and refresh the page.` : undefined
    const hint = !hasParent ? w.first : noAreas ? 'No areas are listed for this town yet.' : undefined
    return (
      <div data-field={key}>
        <SelectField
          label={key === 'areaId' && mode === 'form' ? 'Area (optional)' : w.label}
          value={value[key]}
          disabled={!hasParent || list.loading || noAreas}
          hint={hint}
          error={errors[key] ?? loadError}
          onChange={(e) => onChange(changePlace(value, key, e.target.value))}
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

  return (
    <div className={cx('grid gap-x-3 gap-y-4 sm:grid-cols-2', className)}>
      {field('stateId', options.states)}
      {field('districtId', options.districts)}
      {field('cityId', options.cities)}
      {field('areaId', options.areas)}
    </div>
  )
}
