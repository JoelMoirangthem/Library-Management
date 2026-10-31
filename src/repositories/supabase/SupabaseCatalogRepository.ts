import { AppError } from '@/domain/errors'
import type { Area, City, District, State } from '@/domain/types'
import { getSupabase } from '@/lib/supabase'
import type { CatalogRepository } from '@/repositories/interfaces'
import { toAppErrorFromSupabase, unwrap } from '@/repositories/supabase/errors'
import { fetchAll } from '@/repositories/supabase/paging'

type StateRow = { id: string; name: string; is_union_territory: boolean }
type DistrictRow = { id: string; state_id: string; name: string }
type CityRow = { id: string; state_id: string; name: string; is_active: boolean }
type AreaRow = { id: string; city_id: string; name: string; is_active: boolean }

const CITY_COLUMNS = 'id, state_id, name, is_active'
const toState = (r: StateRow): State => ({ id: r.id, name: r.name, isUnionTerritory: r.is_union_territory })
const toDistrict = (r: DistrictRow): District => ({ id: r.id, stateId: r.state_id, name: r.name })
const toCity = (r: CityRow): City => ({ id: r.id, stateId: r.state_id, name: r.name, isActive: r.is_active })
const toArea = (r: AreaRow): Area => ({ id: r.id, cityId: r.city_id, name: r.name, isActive: r.is_active })
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, 'en')

/** States, districts, towns and areas. Everyone can read them; only an admin can change them (row-level security). */
export class SupabaseCatalogRepository implements CatalogRepository {
  async listStates(): Promise<State[]> {
    const q = getSupabase().from('states').select('id, name, is_union_territory').order('name')
    return unwrap(await q.returns<StateRow[]>()).map(toState)
  }

  async listDistricts(stateId: string): Promise<District[]> {
    const q = getSupabase().from('districts').select('id, state_id, name').eq('state_id', stateId).order('name')
    return unwrap(await q.returns<DistrictRow[]>()).map(toDistrict)
  }

  /** The towns of one district, through the town-district links (a town can be in two districts). */
  async listCities(opts: { districtId: string; includeInactive?: boolean }): Promise<City[]> {
    const supabase = getSupabase()
    const links = await fetchAll((from, to) =>
      supabase
        .from('city_districts')
        .select(`city_id, cities!inner(${CITY_COLUMNS})`)
        .eq('district_id', opts.districtId)
        .order('city_id')
        .range(from, to)
        .returns<{ city_id: string; cities: CityRow }[]>(),
    )
    return links
      .map((l) => toCity(l.cities))
      .filter((c) => opts.includeInactive || c.isActive)
      .sort(byName)
  }

  async listAreas(opts: { cityId?: string; includeInactive?: boolean } = {}): Promise<Area[]> {
    let q = getSupabase().from('areas').select('id, city_id, name, is_active').order('name')
    if (opts.cityId) q = q.eq('city_id', opts.cityId)
    if (!opts.includeInactive) q = q.eq('is_active', true)
    return unwrap(await q.returns<AreaRow[]>()).map(toArea)
  }

  /**
   * Area names for the Discover filter. The database merges the admin's areas with the areas libraries typed.
   * One request returns at most 1000 rows (D-032) and typed areas have no upper bound, so read page by page.
   * The names are unique within a town, so ordering by name is the unique sort order paging needs.
   */
  async listAreaNames(cityId: string): Promise<string[]> {
    const supabase = getSupabase()
    const rows = await fetchAll(async (from, to) => {
      const r = await supabase.rpc('area_names', { p_city: cityId }).order('name').range(from, to)
      return { data: r.data as { name: string }[] | null, error: r.error }
    })
    return rows.sort(byName).map((r) => r.name)
  }

  async addCity(districtId: string, name: string): Promise<City> {
    const n = name.trim()
    if (!n) throw new AppError('invalid', 'Enter a town name.')
    const supabase = getSupabase()
    const { data: id, error } = await supabase.rpc('admin_add_city', { p_district: districtId, p_name: n })
    if (error) throw toAppErrorFromSupabase(error)
    const row = unwrap(await supabase.from('cities').select(CITY_COLUMNS).eq('id', id as string).single<CityRow>())
    return toCity(row)
  }

  async addArea(cityId: string, name: string): Promise<Area> {
    const n = name.trim()
    if (!n) throw new AppError('invalid', 'Enter an area name.')
    const { data, error } = await getSupabase()
      .from('areas')
      .insert({ city_id: cityId, name: n })
      .select('id, city_id, name, is_active')
      .single<AreaRow>()
    if (error?.code === '23505') throw new AppError('conflict', `${n} already exists in this town.`)
    if (error) throw toAppErrorFromSupabase(error)
    return toArea(data)
  }

  async setCityActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await getSupabase().from('cities').update({ is_active: isActive }).eq('id', id)
    if (error) throw toAppErrorFromSupabase(error)
  }

  async setAreaActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await getSupabase().from('areas').update({ is_active: isActive }).eq('id', id)
    if (error) throw toAppErrorFromSupabase(error)
  }
}
