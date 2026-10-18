import { AppError } from '@/domain/errors'
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
import { fetchAll } from '@/repositories/supabase/paging'
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
  city_id: i.cityId,
  area_id: i.areaId,
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
    const { data, error } = await getSupabase().rpc('public_libraries', {
      p_city: filter.cityId ?? null,
      p_area: filter.areaId ?? null,
      p_max_fee_paise: filter.maxFeePaise ?? null,
      p_amenities: filter.amenities?.length ? filter.amenities : null,
    })
    if (error) throw toAppErrorFromSupabase(error)
    return ((data ?? []) as PublicLibraryRow[]).map(toPublicLibrary)
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
    const [libs, owners, cities, areas, subs, shiftRows] = await Promise.all([
      fetchAll((from, to) =>
        supabase.from('libraries').select(LIBRARY_COLUMNS).order('created_at').order('id').range(from, to).returns<LibraryRow[]>(),
      ),
      fetchAll((from, to) =>
        supabase.from('profiles').select('id, name, phone').order('id').range(from, to).returns<{ id: string; name: string; phone: string }[]>(),
      ),
      fetchAll((from, to) =>
        supabase.from('cities').select('id, name').order('id').range(from, to).returns<{ id: string; name: string }[]>(),
      ),
      fetchAll((from, to) =>
        supabase.from('areas').select('id, name').order('id').range(from, to).returns<{ id: string; name: string }[]>(),
      ),
      fetchAll((from, to) =>
        supabase.from('subscriptions').select('library_id, trial_ends_at, active_until').order('library_id').range(from, to).returns<SubscriptionRow[]>(),
      ),
      fetchAll((from, to) => supabase.from('shifts').select(SHIFT_COLUMNS).order('id').range(from, to).returns<ShiftRow[]>()),
    ])
    const ownerById = new Map(owners.map((o) => [o.id, o]))
    const cityById = new Map(cities.map((c) => [c.id, c.name]))
    const areaById = new Map(areas.map((a) => [a.id, a.name]))
    const subByLib = new Map(subs.map((s) => [s.library_id, toSubscription(s)]))

    return libs.map((row) => {
      const library = toLibrary(row)
      const owner = ownerById.get(row.owner_id)
      return {
        library,
        ownerName: owner?.name || 'Unknown',
        ownerPhone: owner?.phone ?? '',
        cityName: cityById.get(row.city_id) ?? '',
        areaName: areaById.get(row.area_id) ?? '',
        subscription: subByLib.get(row.id) ?? null,
        shifts: shiftRows.filter((s) => s.library_id === row.id).map(toShift),
      }
    })
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
