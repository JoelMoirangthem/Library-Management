import type {
  AdminLibraryRow,
  AdminPaymentRow,
  Area,
  City,
  District,
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
  State,
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
  /** Real mode: sends the browser to Google. Mock mode uses DemoLogin instead and throws here. */
  signInWithGoogle(): Promise<void>
  /** The administrator's sign-in (the /admin-login page). Resolves to the profile ONLY for an admin; anyone else is signed out again. */
  signInAdmin(userId: string, password: string): Promise<Profile>
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

/**
 * States, districts, towns and areas. Everyone can read them; only an admin can add a town or area or switch one off.
 * Towns are always listed for one district (a state has hundreds), never all at once.
 */
export interface CatalogRepository {
  listStates(): Promise<State[]>
  listDistricts(stateId: string): Promise<District[]>
  listCities(opts: { districtId: string; includeInactive?: boolean }): Promise<City[]>
  listAreas(opts?: { cityId?: string; includeInactive?: boolean }): Promise<Area[]>
  /**
   * The area names to filter by on Discover: the admin's active areas for the town plus the areas typed by libraries
   * students can find, without duplicates (case and extra spaces ignored), sorted A-Z. Names only. Open to everyone.
   */
  listAreaNames(cityId: string): Promise<string[]>
  /** Admin. Adds a town that the official list is missing, in one district. */
  addCity(districtId: string, name: string): Promise<City>
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
  /** Admin. How many libraries wait for review: a cheap count for the menu badge, without loading the list. */
  countPendingForAdmin(): Promise<number>
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
  /** Admin. How many plan payments wait for a check: a cheap count for the menu badge, without loading the list. */
  countPendingForAdmin(): Promise<number>
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

/** Library photos: files in storage, referenced from the library by their public links. */
export interface PhotoRepository {
  /** Stores one (already shrunk) JPEG in the signed-in owner's own folder and returns its public link. */
  upload(image: Blob): Promise<string>
  /** Deletes stored files by their links. Links that are not stored files are ignored. */
  remove(urls: string[]): Promise<void>
  /** Deletes every file in the owner's folder that is not in urls: tidies up abandoned uploads. */
  keepOnly(urls: string[]): Promise<void>
}
