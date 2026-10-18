import { AppError } from '@/domain/errors'
import { normalizePhone } from '@/domain/constants'
import type { FeePayment, Member, MyMembership, PublicLibrary } from '@/domain/types'
import { getSupabase } from '@/lib/supabase'
import type { FeeRepository, MemberRepository, NewMember, RenewInput } from '@/repositories/interfaces'
import { toAppErrorFromSupabase, unwrap } from '@/repositories/supabase/errors'
import {
  currentUserId,
  FEE_COLUMNS,
  MEMBER_COLUMNS,
  toFee,
  toMember,
  type FeeRow,
  type MemberRow,
} from '@/repositories/supabase/mappers'

async function loadMember(id: string): Promise<Member> {
  const { data, error } = await getSupabase().from('members').select(MEMBER_COLUMNS).eq('id', id).maybeSingle<MemberRow>()
  if (error) throw toAppErrorFromSupabase(error)
  if (!data) throw new AppError('not_found', 'Student not found.')
  return toMember(data)
}

/** Every change goes through a database function that checks the caller and does the whole job in one step. */
export class SupabaseMemberRepository implements MemberRepository {
  async listByLibrary(libraryId: string): Promise<Member[]> {
    const rows = unwrap(
      await getSupabase().from('members').select(MEMBER_COLUMNS).eq('library_id', libraryId).returns<MemberRow[]>(),
    )
    return rows.map(toMember)
  }

  async add(input: NewMember): Promise<Member> {
    const { data, error } = await getSupabase().rpc('add_member', {
      p_library: input.libraryId,
      p_shift: input.shiftId,
      p_name: input.name,
      p_phone: normalizePhone(input.phone),
      p_seat: input.seatId,
      p_start: input.startDate,
      p_expiry: input.expiryDate,
      p_fee_paise: input.firstFee?.amountPaise ?? null,
      p_fee_mode: input.firstFee?.mode ?? null,
    })
    if (error) throw toAppErrorFromSupabase(error)
    return loadMember(data as string)
  }

  async update(memberId: string, patch: { name: string; phone: string }): Promise<Member> {
    const { error } = await getSupabase().rpc('update_member', {
      p_member: memberId,
      p_name: patch.name,
      p_phone: normalizePhone(patch.phone),
    })
    if (error) throw toAppErrorFromSupabase(error)
    return loadMember(memberId)
  }

  async remove(memberId: string): Promise<void> {
    const { error } = await getSupabase().rpc('remove_member', { p_member: memberId })
    if (error) throw toAppErrorFromSupabase(error)
  }

  async assignSeat(memberId: string, seatId: string | null): Promise<void> {
    const { error } = await getSupabase().rpc('assign_member_seat', { p_member: memberId, p_seat: seatId })
    if (error) throw toAppErrorFromSupabase(error)
  }

  async renew(input: RenewInput): Promise<void> {
    const { error } = await getSupabase().rpc('renew_member', {
      p_member: input.memberId,
      p_amount_paise: input.amountPaise,
      p_mode: input.mode,
      p_new_expiry: input.newExpiry,
    })
    if (error) throw toAppErrorFromSupabase(error)
  }

  async listMine(): Promise<MyMembership[]> {
    const uid = await currentUserId()
    const { data, error } = await getSupabase().rpc('my_memberships')
    if (error) throw toAppErrorFromSupabase(error)
    type Item = {
      member_id: string
      library_id: string
      library_name: string
      library_phone: string
      area_name: string
      city_name: string
      address: string
      shift_id: string
      shift_name: string
      start_time: string
      end_time: string
      seat_number: number | null
      start_date: string
      expiry_date: string
      payments: { id: string; amount_paise: number; paid_on: string; mode: FeePayment['mode']; is_void: boolean; void_reason: string | null }[]
    }
    return ((data ?? []) as Item[]).map((m) => {
      // The student can see the facts of their membership; the library's full public listing may be hidden (plan expired).
      const library: PublicLibrary = {
        id: m.library_id, name: m.library_name, cityId: '', cityName: m.city_name, areaId: '', areaName: m.area_name,
        address: m.address, pincode: '', landmark: '', phone: m.library_phone, fromFeePaise: 0, timings: '',
        amenities: [], photos: [], totalSeats: 0, shifts: [],
      }
      return {
        member: {
          id: m.member_id, libraryId: m.library_id, studentId: uid, shiftId: m.shift_id, name: '', phone: '',
          seatId: null, startDate: m.start_date, expiryDate: m.expiry_date, status: 'active', removedAt: null,
        },
        shift: {
          id: m.shift_id, libraryId: m.library_id, name: m.shift_name, startTime: m.start_time, endTime: m.end_time,
          monthlyFeePaise: 0, isActive: true,
        },
        library,
        seatNumber: m.seat_number,
        payments: m.payments.map((p) => ({
          id: p.id, memberId: m.member_id, libraryId: m.library_id, amountPaise: p.amount_paise, paidOn: p.paid_on,
          mode: p.mode, isVoid: p.is_void, voidReason: p.void_reason,
        })),
      }
    })
  }
}

export class SupabaseFeeRepository implements FeeRepository {
  async listByLibrary(libraryId: string): Promise<FeePayment[]> {
    const rows = unwrap(
      await getSupabase().from('fee_payments').select(FEE_COLUMNS).eq('library_id', libraryId).returns<FeeRow[]>(),
    )
    return rows.map(toFee)
  }

  async listByMember(memberId: string): Promise<FeePayment[]> {
    const rows = unwrap(
      await getSupabase()
        .from('fee_payments')
        .select(FEE_COLUMNS)
        .eq('member_id', memberId)
        .order('paid_on', { ascending: false })
        .returns<FeeRow[]>(),
    )
    return rows.map(toFee)
  }

  async record(input: { memberId: string; amountPaise: number; paidOn: string; mode: FeePayment['mode'] }): Promise<FeePayment> {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('record_fee', {
      p_member: input.memberId,
      p_amount_paise: input.amountPaise,
      p_paid_on: input.paidOn,
      p_mode: input.mode,
    })
    if (error) throw toAppErrorFromSupabase(error)
    const row = unwrap(
      await supabase.from('fee_payments').select(FEE_COLUMNS).eq('id', data as string).single<FeeRow>(),
    )
    return toFee(row)
  }

  async void(feeId: string, reason: string): Promise<void> {
    const { error } = await getSupabase().rpc('void_fee', { p_fee: feeId, p_reason: reason })
    if (error) throw toAppErrorFromSupabase(error)
  }
}
