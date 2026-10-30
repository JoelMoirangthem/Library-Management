import type { AppError } from '@/domain/errors'
import { placeLine } from '@/domain/places'
import type { Area, City, District, State } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { services } from '@/lib/container'

/** A place choice. Empty string means "not chosen" (or "all" in a search filter). */
export type PlaceValue = { stateId: string; districtId: string; cityId: string; areaId: string }

export const NO_PLACE: PlaceValue = { stateId: '', districtId: '', cityId: '', areaId: '' }

/** One list for a picker. `items` always belong to the current parent; while the parent's list loads it is empty. */
export type PlaceList<T> = { items: T[]; loading: boolean; error: AppError | null; reload: () => void }

export type PlaceOptions = {
  states: PlaceList<State>
  districts: PlaceList<District>
  cities: PlaceList<City>
  areas: PlaceList<Area>
}

function useChildList<T>(parent: string, load: (parent: string) => Promise<T[]>): PlaceList<T> {
  const q = useAsync(async () => ({ parent, items: parent ? await load(parent) : [] }), [parent])
  // Data loaded for an earlier parent (e.g. the districts of the previous state) is never shown.
  const fresh = q.data !== null && q.data.parent === parent
  return {
    items: fresh ? q.data!.items : [],
    loading: Boolean(parent) && !fresh && !q.error,
    error: q.error,
    reload: q.reload,
  }
}

/**
 * Loads the lists for cascading place pickers: all states, the districts of the chosen state, the towns of the chosen
 * district, and the areas of the chosen town. A list is only fetched once its parent is chosen.
 * `includeInactive` (admin) also lists towns and areas that are switched off.
 */
export function usePlaceOptions(value: PlaceValue, opts: { includeInactive?: boolean } = {}): PlaceOptions {
  const includeInactive = Boolean(opts.includeInactive)
  return {
    states: useChildList('all', () => services.listStates()),
    districts: useChildList(value.stateId, (id) => services.listDistricts(id)),
    cities: useChildList(value.districtId, (id) => services.listCities({ districtId: id, includeInactive })),
    areas: useChildList(value.cityId, (id) => services.listAreas({ cityId: id, includeInactive })),
  }
}

/** Changing a place clears the smaller places under it (a new state has other districts). */
export function changePlace(value: PlaceValue, key: keyof PlaceValue, id: string): PlaceValue {
  if (key === 'stateId') return { stateId: id, districtId: '', cityId: '', areaId: '' }
  if (key === 'districtId') return { ...value, districtId: id, cityId: '', areaId: '' }
  if (key === 'cityId') return { ...value, cityId: id, areaId: '' }
  return { ...value, areaId: id }
}

/** The names of the chosen places, once their lists have loaded. */
export function chosenPlaceNames(value: PlaceValue, o: PlaceOptions) {
  const find = <T extends { id: string; name: string }>(list: T[], id: string) =>
    (id && list.find((x) => x.id === id)?.name) || ''
  return {
    stateName: find(o.states.items, value.stateId),
    districtName: find(o.districts.items, value.districtId),
    cityName: find(o.cities.items, value.cityId),
    areaName: find(o.areas.items, value.areaId),
  }
}

/** "Aliganj, Lucknow, Uttar Pradesh" for a review screen. */
export function chosenPlaceLine(value: PlaceValue, o: PlaceOptions): string {
  const n = chosenPlaceNames(value, o)
  return placeLine([n.areaName, n.cityName, n.districtName, n.stateName])
}
