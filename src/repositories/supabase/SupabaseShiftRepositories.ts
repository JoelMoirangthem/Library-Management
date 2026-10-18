import { AppError } from '@/domain/errors'
import { sortShifts } from '@/domain/shifts'
import type { Seat, Shift, ShiftInput, Subscription } from '@/domain/types'
import { getSupabase } from '@/lib/supabase'
import type { SeatRepository, ShiftRepository, SubscriptionRepository } from '@/repositories/interfaces'
import { toAppErrorFromSupabase, unwrap } from '@/repositories/supabase/errors'
import {
  SHIFT_COLUMNS,
  toSeat,
  toShift,
  toSubscription,
  type SeatRow,
  type ShiftRow,
  type SubscriptionRow,
} from '@/repositories/supabase/mappers'

/**
 * Shift rules (max 3 on, no overlaps, at least one on) are enforced by a database trigger, which
 * raises a plain sentence naming the clash. Shifts are never deleted: only switched off.
 */
export class SupabaseShiftRepository implements ShiftRepository {
  async listByLibrary(libraryId: string): Promise<Shift[]> {
    const rows = unwrap(
      await getSupabase().from('shifts').select(SHIFT_COLUMNS).eq('library_id', libraryId).returns<ShiftRow[]>(),
    )
    return sortShifts(rows.map(toShift))
  }

  async add(libraryId: string, input: ShiftInput): Promise<Shift> {
    const { data, error } = await getSupabase()
      .from('shifts')
      .insert({
        library_id: libraryId,
        name: input.name.trim(),
        start_time: input.startTime,
        end_time: input.endTime,
        monthly_fee_paise: input.monthlyFeePaise,
      })
      .select(SHIFT_COLUMNS)
      .single<ShiftRow>()
    if (error?.code === '23505') throw new AppError('conflict', `You already have a shift named ${input.name.trim()}.`)
    if (error) throw toAppErrorFromSupabase(error)
    return toShift(data)
  }

  async update(shiftId: string, input: ShiftInput): Promise<Shift> {
    const { data, error } = await getSupabase()
      .from('shifts')
      .update({
        name: input.name.trim(),
        start_time: input.startTime,
        end_time: input.endTime,
        monthly_fee_paise: input.monthlyFeePaise,
      })
      .eq('id', shiftId)
      .select(SHIFT_COLUMNS)
      .maybeSingle<ShiftRow>()
    if (error?.code === '23505') throw new AppError('conflict', `You already have a shift named ${input.name.trim()}.`)
    if (error) throw toAppErrorFromSupabase(error)
    if (!data) throw new AppError('forbidden', 'Your plan has expired. Renew to make changes.')
    return toShift(data)
  }

  async setActive(shiftId: string, isActive: boolean): Promise<void> {
    const { data, error } = await getSupabase()
      .from('shifts')
      .update({ is_active: isActive })
      .eq('id', shiftId)
      .select('id')
    if (error) throw toAppErrorFromSupabase(error)
    if (!data?.length) throw new AppError('forbidden', 'Your plan has expired. Renew to make changes.')
  }
}

export class SupabaseSubscriptionRepository implements SubscriptionRepository {
  async getByLibrary(libraryId: string): Promise<Subscription | null> {
    const { data, error } = await getSupabase()
      .from('subscriptions')
      .select('library_id, trial_ends_at, active_until')
      .eq('library_id', libraryId)
      .maybeSingle<SubscriptionRow>()
    if (error) throw toAppErrorFromSupabase(error)
    return data ? toSubscription(data) : null
  }
}

export class SupabaseSeatRepository implements SeatRepository {
  async listByLibrary(libraryId: string): Promise<Seat[]> {
    const rows = unwrap(
      await getSupabase()
        .from('seats')
        .select('id, library_id, seat_number, is_active')
        .eq('library_id', libraryId)
        .order('seat_number')
        .returns<SeatRow[]>(),
    )
    return rows.map(toSeat)
  }

  async setCapacity(libraryId: string, capacity: number): Promise<void> {
    const { error } = await getSupabase().rpc('set_library_capacity', { p_library: libraryId, p_capacity: capacity })
    if (error) throw toAppErrorFromSupabase(error)
  }
}
