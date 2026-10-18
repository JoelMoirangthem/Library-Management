import { AppError } from '@/domain/errors'
import type { Area, City } from '@/domain/types'
import { getSupabase } from '@/lib/supabase'
import type { CatalogRepository } from '@/repositories/interfaces'
import { toAppErrorFromSupabase, unwrap } from '@/repositories/supabase/errors'

type CityRow = { id: string; name: string; is_active: boolean }
type AreaRow = { id: string; city_id: string; name: string; is_active: boolean }

const toCity = (r: CityRow): City => ({ id: r.id, name: r.name, isActive: r.is_active })
const toArea = (r: AreaRow): Area => ({ id: r.id, cityId: r.city_id, name: r.name, isActive: r.is_active })

/** Cities and areas. Everyone can read the active ones; only an admin can change them (row-level security). */
export class SupabaseCatalogRepository implements CatalogRepository {
  async listCities(opts: { includeInactive?: boolean } = {}): Promise<City[]> {
    let q = getSupabase().from('cities').select('id, name, is_active').order('name')
    if (!opts.includeInactive) q = q.eq('is_active', true)
    return unwrap(await q.returns<CityRow[]>()).map(toCity)
  }

  async listAreas(opts: { cityId?: string; includeInactive?: boolean } = {}): Promise<Area[]> {
    let q = getSupabase().from('areas').select('id, city_id, name, is_active').order('name')
    if (opts.cityId) q = q.eq('city_id', opts.cityId)
    if (!opts.includeInactive) q = q.eq('is_active', true)
    return unwrap(await q.returns<AreaRow[]>()).map(toArea)
  }

  async addCity(name: string): Promise<City> {
    const n = name.trim()
    if (!n) throw new AppError('invalid', 'Enter a city name.')
    const { data, error } = await getSupabase().from('cities').insert({ name: n }).select('id, name, is_active').single<CityRow>()
    if (error?.code === '23505') throw new AppError('conflict', `${n} already exists.`)
    if (error) throw toAppErrorFromSupabase(error)
    return toCity(data)
  }

  async addArea(cityId: string, name: string): Promise<Area> {
    const n = name.trim()
    if (!n) throw new AppError('invalid', 'Enter an area name.')
    const { data, error } = await getSupabase()
      .from('areas')
      .insert({ city_id: cityId, name: n })
      .select('id, city_id, name, is_active')
      .single<AreaRow>()
    if (error?.code === '23505') throw new AppError('conflict', `${n} already exists in this city.`)
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
