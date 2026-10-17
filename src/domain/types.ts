/** Plain data shapes shared by every layer. No behaviour here. Dates: `YYYY-MM-DD` strings (IST day) or ISO timestamps. */

export type Role = 'student' | 'owner' | 'admin'

export type Profile = {
  id: string
  name: string
  email: string
  phone: string
  /** null until the user picks Student or Owner (BR-7). */
  role: Role | null
}

export type City = { id: string; name: string; isActive: boolean }
export type Area = { id: string; cityId: string; name: string; isActive: boolean }

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export type Library = {
  id: string
  ownerId: string
  name: string
  cityId: string
  areaId: string
  address: string
  pincode: string
  landmark: string
  phone: string
  capacity: number
  timings: string
  amenities: string[]
  /** Image URLs or data URLs. May be empty. */
  photos: string[]
  approvalStatus: ApprovalStatus
  rejectionReason: string | null
  createdAt: string
}

/** What an owner types into the library form. */
export type LibraryInput = Omit<
  Library,
  'id' | 'ownerId' | 'approvalStatus' | 'rejectionReason' | 'createdAt'
>

/** A time slot a seat can be rented for, e.g. Morning 08:30-12:30. Times are HH:MM (24h); end may be earlier than start for a shift that crosses midnight. */
export type Shift = {
  id: string
  libraryId: string
  name: string
  startTime: string
  endTime: string
  /** Each shift sets its own monthly fee. */
  monthlyFeePaise: number
  /** Shifts are never deleted. Switching one off hides it from new students; existing students stay tagged to it. */
  isActive: boolean
}

export type ShiftInput = Pick<Shift, 'name' | 'startTime' | 'endTime' | 'monthlyFeePaise'>

export type Subscription = {
  libraryId: string
  /** Display only. */
  trialEndsAt: string
  /** The only value rules check. ISO timestamp. */
  activeUntil: string
}

export type PaymentStatus = 'pending' | 'verified' | 'failed'

export type PlanPayment = {
  id: string
  libraryId: string
  amountPaise: number
  utr: string
  status: PaymentStatus
  failureReason: string | null
  submittedAt: string
  verifiedAt: string | null
}

export type Seat = {
  id: string
  libraryId: string
  seatNumber: number
  isActive: boolean
}

export type MemberStatus = 'active' | 'removed'

export type Member = {
  id: string
  libraryId: string
  studentId: string | null
  /** Which shift this membership is for. A student in two shifts has two members. */
  shiftId: string
  name: string
  phone: string
  seatId: string | null
  startDate: string
  /** "Paid until". */
  expiryDate: string
  status: MemberStatus
  removedAt: string | null
}

export type FeeMode = 'cash' | 'upi' | 'other'

export type FeePayment = {
  id: string
  memberId: string
  libraryId: string
  amountPaise: number
  paidOn: string
  mode: FeeMode
  isVoid: boolean
  voidReason: string | null
}

export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export type SeatRequest = {
  id: string
  studentId: string
  studentName: string
  studentPhone: string
  libraryId: string
  shiftId: string
  status: RequestStatus
  createdAt: string
  decidedAt: string | null
}

/** A request plus the library it points at, for the student's "My requests" list. */
export type MySeatRequest = SeatRequest & {
  libraryName: string
  areaName: string
  cityName: string
  shiftName: string
}

/** One shift as students see it, with live seats left for that shift. */
export type PublicShift = {
  id: string
  name: string
  startTime: string
  endTime: string
  monthlyFeePaise: number
  totalSeats: number
  seatsLeft: number
}

/** Public view of a library: no owner id, no rejection reason, plus live seat counts per shift. */
export type PublicLibrary = {
  id: string
  name: string
  cityId: string
  cityName: string
  areaId: string
  areaName: string
  address: string
  pincode: string
  landmark: string
  phone: string
  /** Lowest monthly fee across active shifts (show as 'from'). */
  fromFeePaise: number
  timings: string
  amenities: string[]
  photos: string[]
  /** Physical seats in use (not per shift). */
  totalSeats: number
  /** Active shifts only. Seats left is per shift: a seat full in the morning can be free in the afternoon. */
  shifts: PublicShift[]
}

export type PublicSearchFilter = {
  cityId?: string
  areaId?: string
  /** Matches libraries with at least one active shift at or under this fee. */
  maxFeePaise?: number
  amenities?: string[]
}

/** Admin list row. */
export type AdminLibraryRow = {
  library: Library
  ownerName: string
  ownerPhone: string
  cityName: string
  areaName: string
  subscription: Subscription | null
  shifts: Shift[]
}

export type AdminPaymentRow = PlanPayment & { libraryName: string; ownerName: string }

/** A student's own membership at a library. */
export type MyMembership = {
  member: Member
  shift: Shift | null
  library: PublicLibrary | null
  seatNumber: number | null
  payments: FeePayment[]
}
