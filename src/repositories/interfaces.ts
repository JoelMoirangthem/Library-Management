import type {
  AdminLibraryRow,
  AdminPaymentRow,
  Area,
  City,
  FeeMode,
  FeePayment,
  Library,
  LibraryInput,
  Member,
  MyMembership,
  MySeatRequest,
  PlanPayment,
  Profile,
  PublicLibrary,
  PublicSearchFilter,
  Role,
  Seat,
  SeatRequest,
  Shift,
  ShiftInput,
  Subscription,
} from '@/domain/types'

/**
 * Small interfaces, one per need (Interface Segregation). Services depend on these,
 * never on Supabase or the mock directly (Dependency Inversion).
 * Every method resolves or rejects with an AppError.
 * The "current user" is implicit, like `auth.uid()` in the database.
 */

export interface AuthRepository {
  getSession(): Promise<Profile | null>
  signOut(): Promise<void>
  /** Once only: student or owner (BR-7). */
  setMyRole(role: 'student' | 'owner'): Promise<Profile>
  updateProfile(patch: { name: string; phone: string }): Promise<Profile>
}

/** Mock mode only: stands in for Google sign-in. */
export interface DemoLogin {
  listAccounts(): Promise<Profile[]>
  signInAs(userId: string): Promise<Profile>
  signUpNewUser(name: string, email: string): Promise<Profile>
}

export interface CatalogRepository {
  listCities(opts?: { includeInactive?: boolean }): Promise<City[]>
  listAreas(opts?: { cityId?: string; includeInactive?: boolean }): Promise<Area[]>
  addCity(name: string): Promise<City>
  addArea(cityId: string, name: string): Promise<Area>
  setCityActive(id: string, isActive: boolean): Promise<void>
  setAreaActive(id: string, isActive: boolean): Promise<void>
}

export interface LibraryRepository {
  getMine(): Promise<Library | null>
  getById(id: string): Promise<Library | null>
  /** Creates the library and its 1-3 starting shifts together. */
  create(input: LibraryInput, shifts: ShiftInput[]): Promise<Library>
  update(id: string, input: LibraryInput): Promise<Library>
  /** rejected -> pending. */
  submitForReview(id: string): Promise<Library>
  searchPublic(filter: PublicSearchFilter): Promise<PublicLibrary[]>
  getPublic(id: string): Promise<PublicLibrary | null>
  /** Admin. */
  listForAdmin(): Promise<AdminLibraryRow[]>
  approve(id: string): Promise<void>
  reject(id: string, reason: string): Promise<void>
}

export interface ShiftRepository {
  /** All shifts including switched-off ones, in clock order. Owner or admin. */
  listByLibrary(libraryId: string): Promise<Shift[]>
  add(libraryId: string, input: ShiftInput): Promise<Shift>
  update(shiftId: string, input: ShiftInput): Promise<Shift>
  /** Shifts are never deleted. Off = hidden from new students; existing students stay tagged. */
  setActive(shiftId: string, isActive: boolean): Promise<void>
}

export interface SubscriptionRepository {
  getByLibrary(libraryId: string): Promise<Subscription | null>
}

export interface PlanPaymentRepository {
  listByLibrary(libraryId: string): Promise<PlanPayment[]>
  /** Allowed even when the plan has expired. Amount is fixed by the database. */
  submit(libraryId: string, utr: string): Promise<PlanPayment>
  /** Admin. */
  listAll(): Promise<AdminPaymentRow[]>
  verify(paymentId: string): Promise<void>
  fail(paymentId: string, reason: string): Promise<void>
}

export interface SeatRepository {
  listByLibrary(libraryId: string): Promise<Seat[]>
  /** Adds seats, or deactivates free seats only. */
  setCapacity(libraryId: string, capacity: number): Promise<void>
}

export type NewMember = {
  libraryId: string
  name: string
  phone: string
  shiftId: string
  seatId: string | null
  startDate: string
  expiryDate: string
  firstFee?: { amountPaise: number; mode: FeeMode }
}

export type RenewInput = {
  memberId: string
  amountPaise: number
  mode: FeeMode
  newExpiry: string
}

export interface MemberRepository {
  listByLibrary(libraryId: string): Promise<Member[]>
  add(input: NewMember): Promise<Member>
  update(memberId: string, patch: { name: string; phone: string }): Promise<Member>
  /** Marks removed and frees the seat. Never deletes. */
  remove(memberId: string): Promise<void>
  /** Assign or free (null) a seat. */
  assignSeat(memberId: string, seatId: string | null): Promise<void>
  /** Records the fee and extends the expiry in one step. */
  renew(input: RenewInput): Promise<void>
  /** Student: my memberships across libraries. */
  listMine(): Promise<MyMembership[]>
}

export interface FeeRepository {
  listByLibrary(libraryId: string): Promise<FeePayment[]>
  listByMember(memberId: string): Promise<FeePayment[]>
  record(input: { memberId: string; amountPaise: number; paidOn: string; mode: FeeMode }): Promise<FeePayment>
  /** Voids, never deletes. */
  void(feeId: string, reason: string): Promise<void>
}

export type ApproveRequestInput = {
  requestId: string
  seatId: string
  startDate: string
  expiryDate: string
  amountPaise: number
  mode: FeeMode
}

export interface SeatRequestRepository {
  create(libraryId: string, shiftId: string): Promise<SeatRequest>
  cancel(requestId: string): Promise<void>
  listMine(): Promise<MySeatRequest[]>
  listByLibrary(libraryId: string): Promise<SeatRequest[]>
  /** Creates the member, assigns the seat, records the fee and marks approved, together. */
  approve(input: ApproveRequestInput): Promise<void>
  reject(requestId: string): Promise<void>
}

export type { Role }
