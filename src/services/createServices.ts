import type { LibraryInput, ShiftInput } from '@/domain/types'
import type {
  AuthRepository,
  CatalogRepository,
  FeeRepository,
  LibraryRepository,
  MemberRepository,
  PhotoRepository,
  PlanPaymentRepository,
  SeatRepository,
  SeatRequestRepository,
  ShiftRepository,
  SubscriptionRepository,
} from '@/repositories/interfaces'

export type Repositories = {
  auth: AuthRepository
  catalog: CatalogRepository
  libraries: LibraryRepository
  subscriptions: SubscriptionRepository
  shifts: ShiftRepository
  planPayments: PlanPaymentRepository
  seats: SeatRepository
  members: MemberRepository
  fees: FeeRepository
  seatRequests: SeatRequestRepository
  photos: PhotoRepository
}

/**
 * Services = one function per use case, depending only on repository interfaces.
 * Most are one line because the real rules live in the database (and in the mock that mimics it).
 * Pages and hooks call these, never repositories.
 */
export function createServices(r: Repositories) {
  return {
    // auth
    getSession: () => r.auth.getSession(),
    signInWithGoogle: () => r.auth.signInWithGoogle(),
    signInAdmin: (userId: string, password: string) => r.auth.signInAdmin(userId, password),
    signOut: () => r.auth.signOut(),
    chooseRole: (role: 'student' | 'owner') => r.auth.setMyRole(role),
    updateProfile: (patch: { name: string; phone: string }) => r.auth.updateProfile(patch),

    // catalog (states, districts, towns and areas)
    listStates: () => r.catalog.listStates(),
    listDistricts: (stateId: string) => r.catalog.listDistricts(stateId),
    listCities: (opts: { districtId: string; includeInactive?: boolean }) => r.catalog.listCities(opts),
    listAreas: (opts?: { cityId?: string; includeInactive?: boolean }) => r.catalog.listAreas(opts),
    listAreaNames: (cityId: string) => r.catalog.listAreaNames(cityId),
    addCity: (districtId: string, name: string) => r.catalog.addCity(districtId, name),
    addArea: (cityId: string, name: string) => r.catalog.addArea(cityId, name),
    setCityActive: (id: string, on: boolean) => r.catalog.setCityActive(id, on),
    setAreaActive: (id: string, on: boolean) => r.catalog.setAreaActive(id, on),

    // library
    getMyLibrary: () => r.libraries.getMine(),
    getLibrary: (id: string) => r.libraries.getById(id),
    // After a save, delete any photo files the library no longer uses. A failed tidy-up never fails the save.
    createLibrary: async (input: LibraryInput, shifts: ShiftInput[]) => {
      const lib = await r.libraries.create(input, shifts)
      await r.photos.keepOnly(lib.photos).catch(() => undefined)
      return lib
    },
    updateLibrary: async (id: string, input: LibraryInput) => {
      const lib = await r.libraries.update(id, input)
      await r.photos.keepOnly(lib.photos).catch(() => undefined)
      return lib
    },
    uploadPhoto: (image: Blob) => r.photos.upload(image),
    removePhotos: (urls: string[]) => r.photos.remove(urls),
    resubmitLibrary: (id: string) => r.libraries.submitForReview(id),
    searchLibraries: r.libraries.searchPublic.bind(r.libraries),
    getPublicLibrary: (id: string) => r.libraries.getPublic(id),
    getSubscription: (libraryId: string) => r.subscriptions.getByLibrary(libraryId),

    // admin: libraries
    listLibrariesForAdmin: () => r.libraries.listForAdmin(),
    countPendingLibraries: () => r.libraries.countPendingForAdmin(),
    approveLibrary: (id: string) => r.libraries.approve(id),
    rejectLibrary: (id: string, reason: string) => r.libraries.reject(id, reason),

    // billing
    listMyPlanPayments: (libraryId: string) => r.planPayments.listByLibrary(libraryId),
    submitPlanPayment: (libraryId: string, utr: string) => r.planPayments.submit(libraryId, utr),
    listAllPlanPayments: () => r.planPayments.listAll(),
    countPendingPlanPayments: () => r.planPayments.countPendingForAdmin(),
    verifyPlanPayment: (id: string) => r.planPayments.verify(id),
    failPlanPayment: (id: string, reason: string) => r.planPayments.fail(id, reason),

    // shifts (never deleted; switch off instead)
    listShifts: (libraryId: string) => r.shifts.listByLibrary(libraryId),
    addShift: r.shifts.add.bind(r.shifts),
    updateShift: r.shifts.update.bind(r.shifts),
    setShiftActive: (shiftId: string, on: boolean) => r.shifts.setActive(shiftId, on),

    // seats
    listSeats: (libraryId: string) => r.seats.listByLibrary(libraryId),
    setCapacity: (libraryId: string, capacity: number) => r.seats.setCapacity(libraryId, capacity),

    // members
    listMembers: (libraryId: string) => r.members.listByLibrary(libraryId),
    addMember: r.members.add.bind(r.members),
    updateMember: (id: string, patch: { name: string; phone: string }) => r.members.update(id, patch),
    removeMember: (id: string) => r.members.remove(id),
    assignSeat: (memberId: string, seatId: string | null) => r.members.assignSeat(memberId, seatId),
    renewMember: r.members.renew.bind(r.members),
    listMyMemberships: () => r.members.listMine(),

    // fees
    listLibraryFees: (libraryId: string) => r.fees.listByLibrary(libraryId),
    listMemberFees: (memberId: string) => r.fees.listByMember(memberId),
    recordFee: r.fees.record.bind(r.fees),
    voidFee: (feeId: string, reason: string) => r.fees.void(feeId, reason),

    // seat requests
    requestSeat: (libraryId: string, shiftId: string) => r.seatRequests.create(libraryId, shiftId),
    cancelSeatRequest: (id: string) => r.seatRequests.cancel(id),
    listMySeatRequests: () => r.seatRequests.listMine(),
    listLibrarySeatRequests: (libraryId: string) => r.seatRequests.listByLibrary(libraryId),
    approveSeatRequest: r.seatRequests.approve.bind(r.seatRequests),
    rejectSeatRequest: (id: string) => r.seatRequests.reject(id),
  }
}

export type Services = ReturnType<typeof createServices>
