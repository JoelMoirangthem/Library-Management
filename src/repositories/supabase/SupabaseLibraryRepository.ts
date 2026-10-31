import { AppError } from '@/domain/errors'
import { cleanArea } from '@/domain/areas'
import type {
  AdminLibraryRow,
  Library,
  LibraryInput,
  PublicLibrary,
  PublicSearchFilter,
  ShiftInput,
} from '@/domain/types'
import { getSupabase } from '@/lib/supabase'
import type { LibraryRepository } from '@/repositories/interfaces'
import { toAppErrorFromSupabase } from '@/repositories/supabase/errors'
import { fetchAll, fetchByIds } from '@/repositories/supabase/paging'
import {
  currentUserId,
  LIBRARY_COLUMNS,
  SHIFT_COLUMNS,
  toLibrary,
  toPublicLibrary,
  toShift,
  toSubscription,
  type LibraryRow,
  type PublicLibraryRow,
  type ShiftRow,
  type SubscriptionRow,
} from '@/repositories/supabase/mappers'

const toDbInput = (i: LibraryInput) => ({
  name: i.name,
  state_id: i.stateId,
  district_id: i.districtId,
  city_id: i.cityId,
  // The database also tidies and checks this (libraries_area_tidy, migration 0016).
  area: cleanArea(i.area),
  address: i.address,
  landmark: i.landmark,
  pincode: i.pincode,
  phone: i.phone,
  capacity: i.capacity,
  timings: i.timings,
  amenities: i.amenities,
  photos: i.photos,
})

export class SupabaseLibraryRepository implements LibraryRepository {
  async getMine(): Promise<Library | null> {
    const uid = await currentUserId()
    const { data, error } = await getSupabase()
      .from('libraries')
      .select(LIBRARY_COLUMNS)
      .eq('owner_id', uid)
      .maybeSingle<LibraryRow>()
    if (error) throw toAppErrorFromSupabase(error)
    return data ? toLibrary(data) : null
  }

  async getById(id: string): Promise<Library | null> {
    const { data, error } = await getSupabase()
      .from('libraries')
      .select(LIBRARY_COLUMNS)
      .eq('id', id)
      .maybeSingle<LibraryRow>()
    if (error) throw toAppErrorFromSupabase(error)
    return data ? toLibrary(data) : null
  }

  /** The library and its starting shifts are created together in one database step. */
  async create(input: LibraryInput, shifts: ShiftInput[]): Promise<Library> {
    const supabase = getSupabase()
    const { data: id, error } = await supabase.rpc('create_library', {
      p_input: toDbInput(input),
      p_shifts: shifts.map((s) => ({
        name: s.name,
        start_time: s.startTime,
        end_time: s.endTime,
        monthly_fee_paise: s.monthlyFeePaise,
      })),
    })
    if (error) throw toAppErrorFromSupabase(error)
    const lib = await this.getById(id as string)
    if (!lib) throw new AppError('unknown', 'Your library was saved but could not be loaded. Refresh the page.')
    return lib
  }

  async update(id: string, input: LibraryInput): Promise<Library> {
    const supabase = getSupabase()
    const current = await this.getById(id)
    if (!current) throw new AppError('not_found', 'Library not found.')

    // The seat count changes through its own function, which also adds or switches off seats.
    if (input.capacity !== current.capacity) {
      const { error } = await supabase.rpc('set_library_capacity', { p_library: id, p_capacity: input.capacity })
      if (error) throw toAppErrorFromSupabase(error)
    }

    const { capacity: _capacity, ...rest } = toDbInput(input)
    void _capacity
    const { data, error } = await supabase
      .from('libraries')
      .update(rest)
      .eq('id', id)
      .select(LIBRARY_COLUMNS)
      .maybeSingle<LibraryRow>()
    if (error) throw toAppErrorFromSupabase(error)
    if (!data) throw new AppError('forbidden', 'Your plan has expired. Renew to make changes.')
    return toLibrary(data)
  }

  async submitForReview(id: string): Promise<Library> {
    const { error } = await getSupabase().rpc('submit_library_for_review', { p_library: id })
    if (error) throw toAppErrorFromSupabase(error)
    const lib = await this.getById(id)
    if (!lib) throw new AppError('not_found', 'Library not found.')
    return lib
  }

  async searchPublic(filter: PublicSearchFilter): Promise<PublicLibrary[]> {
    const supabase = getSupabase()
    const args = {
      p_state: filter.stateId ?? null,
      p_district: filter.districtId ?? null,
      p_city: filter.cityId ?? null,
      p_area: filter.area?.trim() ? cleanArea(filter.area) : null,
      p_max_fee_paise: filter.maxFeePaise ?? null,
      p_amenities: filter.amenities?.length ? filter.amenities : null,
    }
    // One request returns at most 1000 rows, so read the list page by page, in a fixed order.
    const rows = await fetchAll(async (from, to) => {
      const r = await supabase.rpc('public_libraries', args).order('id').range(from, to)
      return { data: r.data as PublicLibraryRow[] | null, error: r.error }
    })
    return rows.map(toPublicLibrary)
  }

  async getPublic(id: string): Promise<PublicLibrary | null> {
    const { data, error } = await getSupabase().rpc('public_library', { p_id: id })
    if (error) throw toAppErrorFromSupabase(error)
    const rows = (data ?? []) as PublicLibraryRow[]
    return rows.length ? toPublicLibrary(rows[0]) : null
  }

  async listForAdmin(): Promise<AdminLibraryRow[]> {
    const supabase = getSupabase()
    // Each list is read page by page (the API caps one request at 1000 rows) with a unique sort order.
    const [libs, subs, shiftRows] = await Promise.all([
      fetchAll((from, to) =>
        supabase.from('libraries').select(LIBRARY_COLUMNS).order('created_at').order('id').range(from, to).returns<LibraryRow[]>(),
      ),
      fetchAll((from, to) =>
        supabase.from('subscriptions').select('library_id, trial_ends_at, active_until').order('library_id').range(from, to).returns<SubscriptionRow[]>(),
      ),
      fetchAll((from, to) => supabase.from('shifts').select(SHIFT_COLUMNS).order('id').range(from, to).returns<ShiftRow[]>()),
    ])
    // Only the owners and places of the libraries listed, not every user or all 5,000 towns.
    type Named = { id: string; name: string }
    const names = (table: string, ids: string[]) =>
      fetchByIds(ids, (group) => supabase.from(table).select('id, name').in('id', group).returns<Named[]>())
    const [owners, states, districts, cities] = await Promise.all([
      fetchByIds(libs.map((l) => l.owner_id), (group) =>
        supabase.from('profiles').select('id, name, phone').in('id', group).returns<{ id: string; name: string; phone: string }[]>(),
      ),
      names('states', libs.map((l) => l.state_id)),
      names('districts', libs.map((l) => l.district_id)),
      names('cities', libs.map((l) => l.city_id)),
    ])
    const ownerById = new Map(owners.map((o) => [o.id, o]))
    const nameOf = (rows: Named[]) => {
      const m = new Map(rows.map((r) => [r.id, r.name]))
      return (id: string | null) => (id ? m.get(id) ?? '' : '')
    }
    const [stateName, districtName, cityName] = [nameOf(states), nameOf(districts), nameOf(cities)]
    const subByLib = new Map(subs.map((s) => [s.library_id, toSubscription(s)]))

    return libs.map((row) => {
      const library = toLibrary(row)
      const owner = ownerById.get(row.owner_id)
      return {
        library,
        ownerName: owner?.name || 'Unknown',
        ownerPhone: owner?.phone ?? '',
        stateName: stateName(row.state_id),
        districtName: districtName(row.district_id),
        cityName: cityName(row.city_id),
        areaName: row.area,
        subscription: subByLib.get(row.id) ?? null,
        shifts: shiftRows.filter((s) => s.library_id === row.id).map(toShift),
      }
    })
  }

  async countPendingForAdmin(): Promise<number> {
    const { count, error } = await getSupabase()
      .from('libraries')
      .select('id', { count: 'exact', head: true })
      .eq('approval_status', 'pending')
    if (error) throw toAppErrorFromSupabase(error)
    return count ?? 0
  }

  async approve(id: string): Promise<void> {
    const { error } = await getSupabase().rpc('approve_library', { p_library: id })
    if (error) throw toAppErrorFromSupabase(error)
  }

  async reject(id: string, reason: string): Promise<void> {
    const { error } = await getSupabase().rpc('reject_library', { p_library: id, p_reason: reason })
    if (error) throw toAppErrorFromSupabase(error)
  }
}
