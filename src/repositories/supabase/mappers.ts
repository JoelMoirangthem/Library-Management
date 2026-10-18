import { AppError } from '@/domain/errors'
import type {
  FeePayment,
  Library,
  Member,
  PlanPayment,
  PublicLibrary,
  Seat,
  SeatRequest,
  Shift,
  Subscription,
} from '@/domain/types'
import { getSupabase } from '@/lib/supabase'


/** Row shapes exactly as the database returns them (snake_case). Mappers turn them into app types. */
export type LibraryRow = {
  id: string
  owner_id: string
  name: string
  city_id: string
  area_id: string
  address: string
  landmark: string
  pincode: string
  phone: string
  capacity: number
  timings: string
  amenities: string[]
  photos: string[]
  approval_status: Library['approvalStatus']
  rejection_reason: string | null
  created_at: string
}

export const LIBRARY_COLUMNS =
  'id, owner_id, name, city_id, area_id, address, landmark, pincode, phone, capacity, timings, amenities, photos, approval_status, rejection_reason, created_at'

export const toLibrary = (r: LibraryRow): Library => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  cityId: r.city_id,
  areaId: r.area_id,
  address: r.address,
  landmark: r.landmark,
  pincode: r.pincode,
  phone: r.phone,
  capacity: r.capacity,
  timings: r.timings,
  amenities: r.amenities ?? [],
  photos: r.photos ?? [],
  approvalStatus: r.approval_status,
  rejectionReason: r.rejection_reason,
  createdAt: r.created_at,
})

export type ShiftRow = {
  id: string
  library_id: string
  name: string
  start_time: string
  end_time: string
  monthly_fee_paise: number
  is_active: boolean
}

export const SHIFT_COLUMNS = 'id, library_id, name, start_time, end_time, monthly_fee_paise, is_active'

/** Postgres `time` arrives as "08:30:00"; the app uses "08:30". */
export const hhmm = (t: string) => t.slice(0, 5)

export const toShift = (r: ShiftRow): Shift => ({
  id: r.id,
  libraryId: r.library_id,
  name: r.name,
  startTime: hhmm(r.start_time),
  endTime: hhmm(r.end_time),
  monthlyFeePaise: r.monthly_fee_paise,
  isActive: r.is_active,
})

export type SubscriptionRow = { library_id: string; trial_ends_at: string; active_until: string }
export const toSubscription = (r: SubscriptionRow): Subscription => ({
  libraryId: r.library_id,
  trialEndsAt: r.trial_ends_at,
  activeUntil: r.active_until,
})

export type SeatRow = { id: string; library_id: string; seat_number: number; is_active: boolean }
export const toSeat = (r: SeatRow): Seat => ({
  id: r.id,
  libraryId: r.library_id,
  seatNumber: r.seat_number,
  isActive: r.is_active,
})

export type MemberRow = {
  id: string
  library_id: string
  student_id: string | null
  shift_id: string
  name: string
  phone: string
  seat_id: string | null
  start_date: string
  expiry_date: string
  status: Member['status']
  removed_at: string | null
}
export const MEMBER_COLUMNS =
  'id, library_id, student_id, shift_id, name, phone, seat_id, start_date, expiry_date, status, removed_at'
export const toMember = (r: MemberRow): Member => ({
  id: r.id,
  libraryId: r.library_id,
  studentId: r.student_id,
  shiftId: r.shift_id,
  name: r.name,
  phone: r.phone,
  seatId: r.seat_id,
  startDate: r.start_date,
  expiryDate: r.expiry_date,
  status: r.status,
  removedAt: r.removed_at,
})

export type FeeRow = {
  id: string
  member_id: string
  library_id: string
  amount_paise: number
  paid_on: string
  mode: FeePayment['mode']
  is_void: boolean
  void_reason: string | null
}
export const FEE_COLUMNS = 'id, member_id, library_id, amount_paise, paid_on, mode, is_void, void_reason'
export const toFee = (r: FeeRow): FeePayment => ({
  id: r.id,
  memberId: r.member_id,
  libraryId: r.library_id,
  amountPaise: r.amount_paise,
  paidOn: r.paid_on,
  mode: r.mode,
  isVoid: r.is_void,
  voidReason: r.void_reason,
})

export type PlanPaymentRow = {
  id: string
  library_id: string
  amount_paise: number
  utr: string
  status: PlanPayment['status']
  failure_reason: string | null
  submitted_at: string
  verified_at: string | null
}
export const PLAN_PAYMENT_COLUMNS = 'id, library_id, amount_paise, utr, status, failure_reason, submitted_at, verified_at'
export const toPlanPayment = (r: PlanPaymentRow): PlanPayment => ({
  id: r.id,
  libraryId: r.library_id,
  amountPaise: r.amount_paise,
  utr: r.utr,
  status: r.status,
  failureReason: r.failure_reason,
  submittedAt: r.submitted_at,
  verifiedAt: r.verified_at,
})

export type SeatRequestRow = {
  id: string
  student_id: string
  library_id: string
  shift_id: string
  status: SeatRequest['status']
  created_at: string
  decided_at: string | null
}
export const SEAT_REQUEST_COLUMNS = 'id, student_id, library_id, shift_id, status, created_at, decided_at'

/** Shape returned by the public_libraries / public_library functions. */
export type PublicLibraryRow = {
  id: string
  name: string
  city_id: string
  city_name: string
  area_id: string
  area_name: string
  address: string
  pincode: string
  landmark: string
  phone: string
  timings: string
  amenities: string[]
  photos: string[]
  from_fee_paise: number | null
  total_seats: number
  shifts: {
    id: string
    name: string
    start_time: string
    end_time: string
    monthly_fee_paise: number
    total_seats: number
    seats_left: number
  }[]
}

export const toPublicLibrary = (r: PublicLibraryRow): PublicLibrary => ({
  id: r.id,
  name: r.name,
  cityId: r.city_id,
  cityName: r.city_name,
  areaId: r.area_id,
  areaName: r.area_name,
  address: r.address,
  pincode: r.pincode,
  landmark: r.landmark,
  phone: r.phone,
  fromFeePaise: r.from_fee_paise ?? 0,
  timings: r.timings,
  amenities: r.amenities ?? [],
  photos: r.photos ?? [],
  totalSeats: r.total_seats,
  shifts: (r.shifts ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    startTime: s.start_time,
    endTime: s.end_time,
    monthlyFeePaise: s.monthly_fee_paise,
    totalSeats: s.total_seats,
    seatsLeft: s.seats_left,
  })),
})

/** The signed-in user's id. Row-level security enforces the real rules; this only fills in "me". */
export async function currentUserId(): Promise<string> {
  const { data } = await getSupabase().auth.getSession()
  if (!data.session) throw new AppError('forbidden', 'Sign in to continue.')
  return data.session.user.id
}
