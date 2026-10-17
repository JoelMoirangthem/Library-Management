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
  monthlyFeePaise: number
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
  status: RequestStatus
  createdAt: string
  decidedAt: string | null
}

/** A request plus the library it points at, for the student's "My requests" list. */
export type MySeatRequest = SeatRequest & { libraryName: string; areaName: string; cityName: string }

/** Public view of a library: no owner id, no rejection reason, plus live seat counts. */
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
  monthlyFeePaise: number
  timings: string
  amenities: string[]
  photos: string[]
  totalSeats: number
  seatsLeft: number
}

export type PublicSearchFilter = {
  cityId?: string
  areaId?: string
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
}

export type AdminPaymentRow = PlanPayment & { libraryName: string; ownerName: string }

/** A student's own membership at a library. */
export type MyMembership = {
  member: Member
  library: PublicLibrary | null
  seatNumber: number | null
  payments: FeePayment[]
}
