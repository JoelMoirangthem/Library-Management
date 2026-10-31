import { cleanArea, sameArea } from '@/domain/areas'
import type { AppError } from '@/domain/errors'
import { placeLine } from '@/domain/places'
import type { Area, City, District, State } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { services } from '@/lib/container'

/**
 * A place choice. Empty string means "not chosen" (or "all" in a search filter).
 * `area` is the area NAME: typed by an owner in a form, picked from the area names in a search (D-045).
 */
export type PlaceValue = { stateId: string; districtId: string; cityId: string; area: string }

export const NO_PLACE: PlaceValue = { stateId: '', districtId: '', cityId: '', area: '' }

/** One list for a picker. `items` always belong to the current parent; while the parent's list loads it is empty. */
export type PlaceList<T> = { items: T[]; loading: boolean; error: AppError | null; reload: () => void }

export type PlaceOptions = {
  states: PlaceList<State>
  districts: PlaceList<District>
  cities: PlaceList<City>
  /** Admin only: the area rows of the chosen town, including switched-off ones. Empty unless `includeInactive` is set. */
  areas: PlaceList<Area>
  /** Search only: the area names to filter by in the chosen town. Empty unless `areaNames` is set. */
  areaNames: PlaceList<string>
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
 * Loads the lists for cascading place pickers: all states, the districts of the chosen state, and the towns of the
 * chosen district. A list is only fetched once its parent is chosen.
 * `includeInactive` (admin) also lists towns that are switched off, and loads the admin's area rows for the chosen town.
 * `areaNames` (search) loads the area names students can filter by. Owner forms need neither: they type the area.
 */
export function usePlaceOptions(
  value: PlaceValue,
  opts: { includeInactive?: boolean; areaNames?: boolean } = {},
): PlaceOptions {
  const includeInactive = Boolean(opts.includeInactive)
  return {
    states: useChildList('all', () => services.listStates()),
    districts: useChildList(value.stateId, (id) => services.listDistricts(id)),
    cities: useChildList(value.districtId, (id) => services.listCities({ districtId: id, includeInactive })),
    areas: useChildList(includeInactive ? value.cityId : '', (id) => services.listAreas({ cityId: id, includeInactive })),
    areaNames: useChildList(opts.areaNames ? value.cityId : '', (id) => services.listAreaNames(id)),
  }
}

/** Changing a place clears the smaller places under it (a new state has other districts). */
export function changePlace(value: PlaceValue, key: keyof PlaceValue, id: string): PlaceValue {
  if (key === 'stateId') return { stateId: id, districtId: '', cityId: '', area: '' }
  if (key === 'districtId') return { ...value, districtId: id, cityId: '', area: '' }
  if (key === 'cityId') return { ...value, cityId: id, area: '' }
  return { ...value, area: id }
}

/** The names of the chosen places, once their lists have loaded. The area is shown with the spelling from the list when it matches. */
export function chosenPlaceNames(value: PlaceValue, o: PlaceOptions) {
  const find = <T extends { id: string; name: string }>(list: T[], id: string) =>
    (id && list.find((x) => x.id === id)?.name) || ''
  return {
    stateName: find(o.states.items, value.stateId),
    districtName: find(o.districts.items, value.districtId),
    cityName: find(o.cities.items, value.cityId),
    areaName: o.areaNames.items.find((n) => sameArea(n, value.area)) ?? cleanArea(value.area),
  }
}

/** "Aliganj, Lucknow, Uttar Pradesh" for a review screen. */
export function chosenPlaceLine(value: PlaceValue, o: PlaceOptions): string {
  const n = chosenPlaceNames(value, o)
  return placeLine([n.areaName, n.cityName, n.districtName, n.stateName])
}
