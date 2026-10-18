import type { AdminPaymentRow, MySeatRequest, PlanPayment, SeatRequest } from '@/domain/types'
import { getSupabase } from '@/lib/supabase'
import type {
  ApproveRequestInput,
  PlanPaymentRepository,
  SeatRequestRepository,
} from '@/repositories/interfaces'
import { toAppErrorFromSupabase, unwrap } from '@/repositories/supabase/errors'
import {
  currentUserId,
  PLAN_PAYMENT_COLUMNS,
  SEAT_REQUEST_COLUMNS,
  toPlanPayment,
  type PlanPaymentRow,
  type SeatRequestRow,
} from '@/repositories/supabase/mappers'

/** Plan payments: the amount, the 30-day extension and the status all come from database functions. */
export class SupabasePlanPaymentRepository implements PlanPaymentRepository {
  async listByLibrary(libraryId: string): Promise<PlanPayment[]> {
    const rows = unwrap(
      await getSupabase()
        .from('plan_payments')
        .select(PLAN_PAYMENT_COLUMNS)
        .eq('library_id', libraryId)
        .order('submitted_at', { ascending: false })
        .returns<PlanPaymentRow[]>(),
    )
    return rows.map(toPlanPayment)
  }

  async submit(libraryId: string, utr: string): Promise<PlanPayment> {
    const supabase = getSupabase()
    const { data, error } = await supabase.rpc('submit_plan_payment', { p_library: libraryId, p_utr: utr })
    if (error) throw toAppErrorFromSupabase(error)
    const row = unwrap(
      await supabase.from('plan_payments').select(PLAN_PAYMENT_COLUMNS).eq('id', data as string).single<PlanPaymentRow>(),
    )
    return toPlanPayment(row)
  }

  async listAll(): Promise<AdminPaymentRow[]> {
    const supabase = getSupabase()
    const [pays, libs, owners] = await Promise.all([
      supabase.from('plan_payments').select(PLAN_PAYMENT_COLUMNS).order('submitted_at', { ascending: false }).returns<PlanPaymentRow[]>(),
      supabase.from('libraries').select('id, name, owner_id').returns<{ id: string; name: string; owner_id: string }[]>(),
      supabase.from('profiles').select('id, name').returns<{ id: string; name: string }[]>(),
    ])
    const libById = new Map(unwrap(libs).map((l) => [l.id, l]))
    const ownerById = new Map(unwrap(owners).map((o) => [o.id, o.name]))
    return unwrap(pays).map((row) => {
      const lib = libById.get(row.library_id)
      return {
        ...toPlanPayment(row),
        libraryName: lib?.name ?? 'Unknown',
        ownerName: (lib && ownerById.get(lib.owner_id)) || 'Unknown',
      }
    })
  }

  async verify(paymentId: string): Promise<void> {
    const { error } = await getSupabase().rpc('verify_plan_payment', { p_payment: paymentId })
    if (error) throw toAppErrorFromSupabase(error)
  }

  async fail(paymentId: string, reason: string): Promise<void> {
    const { error } = await getSupabase().rpc('fail_plan_payment', { p_payment: paymentId, p_reason: reason })
    if (error) throw toAppErrorFromSupabase(error)
  }
}

export class SupabaseSeatRequestRepository implements SeatRequestRepository {
  async create(libraryId: string, shiftId: string): Promise<SeatRequest> {
    const supabase = getSupabase()
    const uid = await currentUserId()
    const { data, error } = await supabase.rpc('request_seat', { p_library: libraryId, p_shift: shiftId })
    if (error) throw toAppErrorFromSupabase(error)
    const row = unwrap(
      await supabase.from('seat_requests').select(SEAT_REQUEST_COLUMNS).eq('id', data as string).single<SeatRequestRow>(),
    )
    const me = unwrap(
      await supabase.from('profiles').select('name, phone').eq('id', uid).single<{ name: string; phone: string }>(),
    )
    return toRequest(row, me.name, me.phone)
  }

  async cancel(requestId: string): Promise<void> {
    const { error } = await getSupabase().rpc('cancel_seat_request', { p_request: requestId })
    if (error) throw toAppErrorFromSupabase(error)
  }

  async listMine(): Promise<MySeatRequest[]> {
    const uid = await currentUserId()
    const { data, error } = await getSupabase().rpc('my_seat_requests')
    if (error) throw toAppErrorFromSupabase(error)
    type Item = {
      id: string; library_id: string; library_name: string; area_name: string; city_name: string
      shift_id: string; shift_name: string; status: SeatRequest['status']; created_at: string; decided_at: string | null
    }
    return ((data ?? []) as Item[]).map((r) => ({
      id: r.id, studentId: uid, studentName: '', studentPhone: '', libraryId: r.library_id, shiftId: r.shift_id,
      status: r.status, createdAt: r.created_at, decidedAt: r.decided_at,
      libraryName: r.library_name, areaName: r.area_name, cityName: r.city_name, shiftName: r.shift_name,
    }))
  }

  /** Owners read the requests for their library, and the names/phones of the students who sent them. */
  async listByLibrary(libraryId: string): Promise<SeatRequest[]> {
    const supabase = getSupabase()
    const rows = unwrap(
      await supabase
        .from('seat_requests')
        .select(SEAT_REQUEST_COLUMNS)
        .eq('library_id', libraryId)
        .order('created_at', { ascending: false })
        .returns<SeatRequestRow[]>(),
    )
    const ids = [...new Set(rows.map((r) => r.student_id))]
    const people = ids.length
      ? unwrap(await supabase.from('profiles').select('id, name, phone').in('id', ids).returns<{ id: string; name: string; phone: string }[]>())
      : []
    const byId = new Map(people.map((p) => [p.id, p]))
    return rows.map((r) => toRequest(r, byId.get(r.student_id)?.name || 'Student', byId.get(r.student_id)?.phone ?? ''))
  }

  async approve(input: ApproveRequestInput): Promise<void> {
    const { error } = await getSupabase().rpc('approve_seat_request', {
      p_request: input.requestId,
      p_seat: input.seatId,
      p_start: input.startDate,
      p_expiry: input.expiryDate,
      p_amount_paise: input.amountPaise,
      p_mode: input.mode,
    })
    if (error) throw toAppErrorFromSupabase(error)
  }

  async reject(requestId: string): Promise<void> {
    const { error } = await getSupabase().rpc('reject_seat_request', { p_request: requestId })
    if (error) throw toAppErrorFromSupabase(error)
  }
}

const toRequest = (r: SeatRequestRow, studentName: string, studentPhone: string): SeatRequest => ({
  id: r.id,
  studentId: r.student_id,
  studentName,
  studentPhone,
  libraryId: r.library_id,
  shiftId: r.shift_id,
  status: r.status,
  createdAt: r.created_at,
  decidedAt: r.decided_at,
})
