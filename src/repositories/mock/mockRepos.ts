import { AppError } from '@/domain/errors'
import { todayIST } from '@/domain/dates'
import { PLAN_PRICE_PAISE, canEditProfile, extendedActiveUntil, newTrial } from '@/domain/plan'
import { MAX_ACTIVE_SHIFTS, sortShifts, validateShiftFields, validateShiftSet } from '@/domain/shifts'
import { isValidUtr } from '@/domain/constants'
import type {
  AdminLibraryRow,
  AdminPaymentRow,
  Area,
  City,
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
  PublicShift,
  Seat,
  SeatRequest,
  Shift,
  ShiftInput,
} from '@/domain/types'
import { getNow } from '@/lib/devState'
import type {
  ApproveRequestInput,
  AuthRepository,
  CatalogRepository,
  DemoLogin,
  FeeRepository,
  LibraryRepository,
  MemberRepository,
  NewMember,
  PlanPaymentRepository,
  RenewInput,
  SeatRepository,
  SeatRequestRepository,
  ShiftRepository,
  SubscriptionRepository,
} from '@/repositories/interfaces'
import {
  commit,
  createSeats,
  currentUser,
  findLibrary,
  getDb,
  isLibraryActive,
  requireActiveOwner,
  requireOwner,
  requireRole,
  requireUser,
  run,
  seatsLeftInShift,
  shiftsOf,
  stateOf,
  subscriptionOf,
  uid,
} from '@/repositories/mock/db'

const nowIso = () => getNow().toISOString()

// ---------------------------------------------------------------- helpers

function toPublic(lib: Library): PublicLibrary {
  const db = getDb()
  const shifts: PublicShift[] = sortShifts(shiftsOf(lib.id))
    .filter((s) => s.isActive)
    .map((s) => {
      const { total, left } = seatsLeftInShift(lib.id, s.id)
      return {
        id: s.id,
        name: s.name,
        startTime: s.startTime,
        endTime: s.endTime,
        monthlyFeePaise: s.monthlyFeePaise,
        totalSeats: total,
        seatsLeft: left,
      }
    })
  return {
    id: lib.id,
    name: lib.name,
    cityId: lib.cityId,
    cityName: db.cities.find((c) => c.id === lib.cityId)?.name ?? '',
    areaId: lib.areaId,
    areaName: db.areas.find((a) => a.id === lib.areaId)?.name ?? '',
    address: lib.address,
    pincode: lib.pincode,
    landmark: lib.landmark,
    phone: lib.phone,
    fromFeePaise: shifts.length ? Math.min(...shifts.map((s) => s.monthlyFeePaise)) : 0,
    timings: lib.timings,
    amenities: lib.amenities,
    photos: lib.photos,
    totalSeats: shifts[0]?.totalSeats ?? 0,
    shifts,
  }
}
function assertLibraryInput(input: LibraryInput) {
  const db = getDb()
  const area = db.areas.find((a) => a.id === input.areaId)
  if (!area || area.cityId !== input.cityId) {
    throw new AppError('invalid', 'The area must belong to the selected city.')
  }
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 500) {
    throw new AppError('invalid', 'Seats must be a whole number between 1 and 500.')
  }
}

/** Mirrors the SQL `set_capacity`: add seats, or deactivate FREE seats only. Never deletes. */
function applyCapacity(lib: Library, capacity: number) {
  const db = getDb()
  if (lib.approvalStatus !== 'approved') {
    lib.capacity = capacity
    return
  }
  const mine = db.seats.filter((s) => s.libraryId === lib.id).sort((a, b) => a.seatNumber - b.seatNumber)
  const active = mine.filter((s) => s.isActive)
  if (capacity > active.length) {
    let need = capacity - active.length
    for (const s of mine) {
      if (need === 0) break
      if (!s.isActive) {
        s.isActive = true
        need--
      }
    }
    const max = mine.reduce((m, s) => Math.max(m, s.seatNumber), 0)
    if (need > 0) createSeats(lib.id, max + 1, max + need)
  } else if (capacity < active.length) {
    const held = new Set(
      db.members.filter((m) => m.libraryId === lib.id && m.status === 'active' && m.seatId).map((m) => m.seatId),
    )
    const freeFromTop = [...active].reverse().filter((s) => !held.has(s.id))
    const remove = active.length - capacity
    if (freeFromTop.length < remove) {
      throw new AppError(
        'conflict',
        `${active.length - freeFromTop.length} seats are in use. Free seats first, or set seats to at least ${active.length - freeFromTop.length}.`,
      )
    }
    freeFromTop.slice(0, remove).forEach((s) => (s.isActive = false))
  }
  lib.capacity = capacity
}

/** A seat is free for a shift when no ACTIVE member of that same shift holds it. */
function assertSeatFree(libraryId: string, seatId: string, shiftId: string, exceptMemberId?: string) {
  const db = getDb()
  const seat = db.seats.find((s) => s.id === seatId && s.libraryId === libraryId)
  if (!seat || !seat.isActive) throw new AppError('invalid', 'That seat is not available.')
  const holder = db.members.find(
    (m) => m.seatId === seatId && m.shiftId === shiftId && m.status === 'active' && m.id !== exceptMemberId,
  )
  if (holder) {
    const shiftName = db.shifts.find((x) => x.id === shiftId)?.name ?? 'this shift'
    throw new AppError('conflict', `Seat ${seat.seatNumber} is already taken in ${shiftName} by ${holder.name}.`)
  }
}

/** The shift must belong to the library and be switched on for new students. */
function requireActiveShift(libraryId: string, shiftId: string): Shift {
  const shift = getDb().shifts.find((s) => s.id === shiftId && s.libraryId === libraryId)
  if (!shift) throw new AppError('invalid', 'Choose a shift.')
  if (!shift.isActive) throw new AppError('invalid', `${shift.name} is switched off for new students.`)
  return shift
}
function assertMemberFields(name: string, phone: string) {
  if (!name.trim()) throw new AppError('invalid', 'Enter the student’s name.')
  if (!/^[6-9]\d{9}$/.test(phone.trim())) throw new AppError('invalid', 'Enter a 10-digit mobile number.')
}

function shiftOrThrow(id: string): Shift {
  const s = getDb().shifts.find((x) => x.id === id)
  if (!s) throw new AppError('not_found', 'Shift not found.')
  return s
}

/** Shifts are part of the library profile (BR-6): editable while pending, rejected or active, not once expired. */
function assertCanEditShifts(lib: Library) {
  if (!canEditProfile(stateOf(lib))) {
    throw new AppError('forbidden', 'Your plan has expired. Renew to make changes.')
  }
}

function memberOrThrow(id: string): Member {
  const m = getDb().members.find((x) => x.id === id)
  if (!m) throw new AppError('not_found', 'Student not found.')
  return m
}

// ---------------------------------------------------------------- auth

export class MockAuthRepository implements AuthRepository {
  getSession() {
    return run(() => currentUser())
  }
  signOut() {
    return run(() => {
      getDb().sessionUserId = null
      commit()
    })
  }
  setMyRole(role: 'student' | 'owner') {
    return run(() => {
      const user = requireUser()
      if (user.role) throw new AppError('conflict', 'Your role is already set and cannot be changed.')
      user.role = role
      commit()
      return user
    })
  }
  updateProfile(patch: { name: string; phone: string }) {
    return run(() => {
      const user = requireUser()
      if (!patch.name.trim()) throw new AppError('invalid', 'Enter your name.')
      user.name = patch.name.trim()
      user.phone = patch.phone.trim()
      commit()
      return user
    })
  }
}

export class MockDemoLogin implements DemoLogin {
  listAccounts() {
    return run(() => [...getDb().profiles])
  }
  signInAs(userId: string) {
    return run(() => {
      const db = getDb()
      const p = db.profiles.find((x) => x.id === userId)
      if (!p) throw new AppError('not_found', 'Account not found.')
      db.sessionUserId = p.id
      commit()
      return p
    })
  }
  signUpNewUser(name: string, email: string) {
    return run(() => {
      const db = getDb()
      const profile: Profile = { id: uid('u'), name: name.trim() || 'New user', email, phone: '', role: null }
      db.profiles.push(profile)
      db.sessionUserId = profile.id
      commit()
      return profile
    })
  }
}

// ---------------------------------------------------------------- catalog

export class MockCatalogRepository implements CatalogRepository {
  listCities(opts: { includeInactive?: boolean } = {}) {
    return run(() =>
      getDb()
        .cities.filter((c) => opts.includeInactive || c.isActive)
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
  }
  listAreas(opts: { cityId?: string; includeInactive?: boolean } = {}) {
    return run(() =>
      getDb()
        .areas.filter((a) => (opts.includeInactive || a.isActive) && (!opts.cityId || a.cityId === opts.cityId))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
  }
  addCity(name: string) {
    return run((): City => {
      requireRole('admin')
      const db = getDb()
      const n = name.trim()
      if (!n) throw new AppError('invalid', 'Enter a city name.')
      if (db.cities.some((c) => c.name.toLowerCase() === n.toLowerCase())) {
        throw new AppError('conflict', `${n} already exists.`)
      }
      const city = { id: uid('city'), name: n, isActive: true }
      db.cities.push(city)
      commit()
      return city
    })
  }
  addArea(cityId: string, name: string) {
    return run((): Area => {
      requireRole('admin')
      const db = getDb()
      const n = name.trim()
      if (!n) throw new AppError('invalid', 'Enter an area name.')
      if (!db.cities.some((c) => c.id === cityId)) throw new AppError('not_found', 'City not found.')
      if (db.areas.some((a) => a.cityId === cityId && a.name.toLowerCase() === n.toLowerCase())) {
        throw new AppError('conflict', `${n} already exists in this city.`)
      }
      const area = { id: uid('area'), cityId, name: n, isActive: true }
      db.areas.push(area)
      commit()
      return area
    })
  }
  setCityActive(id: string, isActive: boolean) {
    return run(() => {
      requireRole('admin')
      const c = getDb().cities.find((x) => x.id === id)
      if (!c) throw new AppError('not_found', 'City not found.')
      c.isActive = isActive
      commit()
    })
  }
  setAreaActive(id: string, isActive: boolean) {
    return run(() => {
      requireRole('admin')
      const a = getDb().areas.find((x) => x.id === id)
      if (!a) throw new AppError('not_found', 'Area not found.')
      a.isActive = isActive
      commit()
    })
  }
}

// ---------------------------------------------------------------- libraries

export class MockLibraryRepository implements LibraryRepository {
  getMine() {
    return run(() => {
      const user = requireRole('owner')
      return getDb().libraries.find((l) => l.ownerId === user.id) ?? null
    })
  }
  getById(id: string) {
    return run(() => {
      const user = requireUser()
      const lib = getDb().libraries.find((l) => l.id === id) ?? null
      if (lib && user.role !== 'admin' && lib.ownerId !== user.id) {
        throw new AppError('forbidden', 'You do not have access to this library.')
      }
      return lib
    })
  }
  create(input: LibraryInput, shiftInputs: ShiftInput[]) {
    return run((): Library => {
      const user = requireRole('owner')
      const db = getDb()
      if (db.libraries.some((l) => l.ownerId === user.id)) {
        throw new AppError('conflict', 'You already have a library.')
      }
      assertLibraryInput(input)
      const shiftProblem = validateShiftSet(shiftInputs)
      if (shiftProblem) throw new AppError('invalid', shiftProblem)
      const lib: Library = {
        ...input,
        id: uid('lib'),
        ownerId: user.id,
        approvalStatus: 'pending',
        rejectionReason: null,
        createdAt: nowIso(),
      }
      db.libraries.push(lib)
      for (const s of shiftInputs) {
        db.shifts.push({ ...s, name: s.name.trim(), id: uid('sh'), libraryId: lib.id, isActive: true })
      }
      commit()
      return lib
    })
  }
  update(id: string, input: LibraryInput) {
    return run((): Library => {
      const lib = requireOwner(id)
      if (lib.approvalStatus === 'approved' && !isLibraryActive(lib)) {
        throw new AppError('forbidden', 'Your plan has expired. Renew to make changes.')
      }
      assertLibraryInput(input)
      if (input.capacity !== lib.capacity) applyCapacity(lib, input.capacity)
      Object.assign(lib, { ...input, capacity: lib.capacity })
      commit()
      return lib
    })
  }
  submitForReview(id: string) {
    return run((): Library => {
      const lib = requireOwner(id)
      if (lib.approvalStatus !== 'rejected') throw new AppError('conflict', 'Only a rejected library can be resubmitted.')
      lib.approvalStatus = 'pending'
      lib.rejectionReason = null
      commit()
      return lib
    })
  }
  searchPublic(filter: PublicSearchFilter) {
    return run((): PublicLibrary[] => {
      const db = getDb()
      return db.libraries
        .filter((l) => isLibraryActive(l))
        .filter((l) => db.cities.find((c) => c.id === l.cityId)?.isActive)
        .filter((l) => db.areas.find((a) => a.id === l.areaId)?.isActive)
        .filter((l) => !filter.cityId || l.cityId === filter.cityId)
        .filter((l) => !filter.areaId || l.areaId === filter.areaId)
        .filter(
          (l) =>
            !filter.maxFeePaise ||
            shiftsOf(l.id).some((s) => s.isActive && s.monthlyFeePaise <= filter.maxFeePaise!),
        )
        .filter((l) => !filter.amenities?.length || filter.amenities.every((a) => l.amenities.includes(a)))
        .map(toPublic)
        .sort(
          (a, b) =>
            b.shifts.reduce((n, s) => n + s.seatsLeft, 0) - a.shifts.reduce((n, s) => n + s.seatsLeft, 0),
        )
    })
  }
  getPublic(id: string) {
    return run(() => {
      const lib = getDb().libraries.find((l) => l.id === id)
      return lib && isLibraryActive(lib) ? toPublic(lib) : null
    })
  }
  listForAdmin() {
    return run((): AdminLibraryRow[] => {
      requireRole('admin')
      const db = getDb()
      return db.libraries.map((library) => {
        const owner = db.profiles.find((p) => p.id === library.ownerId)
        return {
          library,
          ownerName: owner?.name ?? 'Unknown',
          ownerPhone: owner?.phone ?? '',
          cityName: db.cities.find((c) => c.id === library.cityId)?.name ?? '',
          areaName: db.areas.find((a) => a.id === library.areaId)?.name ?? '',
          subscription: subscriptionOf(library.id),
          shifts: sortShifts(shiftsOf(library.id)),
        }
      })
    })
  }
  approve(id: string) {
    return run(() => {
      requireRole('admin')
      const db = getDb()
      const lib = findLibrary(id)
      if (lib.approvalStatus !== 'pending') throw new AppError('conflict', 'Only a pending library can be approved.')
      lib.approvalStatus = 'approved'
      lib.rejectionReason = null
      // BR-3: the trial starts on the first approval only.
      if (!subscriptionOf(id)) db.subscriptions.push(newTrial(id, getNow()))
      if (!db.seats.some((s) => s.libraryId === id)) createSeats(id, 1, lib.capacity)
      commit()
    })
  }
  reject(id: string, reason: string) {
    return run(() => {
      requireRole('admin')
      const lib = findLibrary(id)
      if (lib.approvalStatus !== 'pending') throw new AppError('conflict', 'Only a pending library can be rejected.')
      if (!reason.trim()) throw new AppError('invalid', 'Give a reason so the owner can fix it.')
      lib.approvalStatus = 'rejected'
      lib.rejectionReason = reason.trim()
      commit()
    })
  }
}

export class MockShiftRepository implements ShiftRepository {
  listByLibrary(libraryId: string) {
    return run((): Shift[] => {
      const user = requireUser()
      const lib = findLibrary(libraryId)
      if (user.role !== 'admin' && lib.ownerId !== user.id) throw new AppError('forbidden', 'Not allowed.')
      return sortShifts(shiftsOf(libraryId))
    })
  }
  add(libraryId: string, input: ShiftInput) {
    return run((): Shift => {
      const lib = requireOwner(libraryId)
      assertCanEditShifts(lib)
      const active = shiftsOf(libraryId).filter((s) => s.isActive)
      if (active.length >= MAX_ACTIVE_SHIFTS) {
        throw new AppError('conflict', `You can run up to ${MAX_ACTIVE_SHIFTS} shifts. Switch one off first.`)
      }
      const problem = validateShiftSet([...active, input])
      if (problem) throw new AppError('invalid', problem)
      const shift: Shift = { ...input, name: input.name.trim(), id: uid('sh'), libraryId, isActive: true }
      getDb().shifts.push(shift)
      commit()
      return shift
    })
  }
  update(shiftId: string, input: ShiftInput) {
    return run((): Shift => {
      const shift = shiftOrThrow(shiftId)
      assertCanEditShifts(requireOwner(shift.libraryId))
      const others = shiftsOf(shift.libraryId).filter((s) => s.isActive && s.id !== shiftId)
      // A switched-off shift only needs valid fields; an active one must also fit with the others.
      const problem = shift.isActive ? validateShiftSet([...others, input]) : validateShiftFields(input)
      if (problem) throw new AppError('invalid', problem)
      Object.assign(shift, { ...input, name: input.name.trim() })
      commit()
      return shift
    })
  }
  setActive(shiftId: string, isActive: boolean) {
    return run(() => {
      const shift = shiftOrThrow(shiftId)
      assertCanEditShifts(requireOwner(shift.libraryId))
      if (shift.isActive === isActive) return
      const active = shiftsOf(shift.libraryId).filter((s) => s.isActive)
      if (!isActive && active.length <= 1) throw new AppError('conflict', 'Keep at least one shift on.')
      if (isActive) {
        const problem = validateShiftSet([...active, shift])
        if (problem) throw new AppError('conflict', problem)
      }
      // Students already in this shift stay tagged to it and keep their seats; nothing is deleted.
      shift.isActive = isActive
      commit()
    })
  }
}
export class MockSubscriptionRepository implements SubscriptionRepository {
  getByLibrary(libraryId: string) {
    return run(() => {
      const user = requireUser()
      const lib = findLibrary(libraryId)
      if (user.role !== 'admin' && lib.ownerId !== user.id) throw new AppError('forbidden', 'Not allowed.')
      return subscriptionOf(libraryId)
    })
  }
}

// ---------------------------------------------------------------- plan payments

export class MockPlanPaymentRepository implements PlanPaymentRepository {
  listByLibrary(libraryId: string) {
    return run(() => {
      requireOwner(libraryId)
      return getDb()
        .planPayments.filter((p) => p.libraryId === libraryId)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    })
  }
  submit(libraryId: string, utr: string) {
    return run((): PlanPayment => {
      const lib = requireOwner(libraryId)
      if (lib.approvalStatus !== 'approved') {
        throw new AppError('forbidden', 'You can pay once your library is approved.')
      }
      const ref = utr.trim()
      if (!isValidUtr(ref)) throw new AppError('invalid', 'The UTR is 12 digits. Check your UPI app.')
      const db = getDb()
      if (db.planPayments.some((p) => p.utr === ref)) {
        throw new AppError('conflict', 'This UTR was already submitted.')
      }
      if (db.planPayments.some((p) => p.libraryId === libraryId && p.status === 'pending')) {
        throw new AppError('conflict', 'A payment is already waiting to be verified.')
      }
      const payment: PlanPayment = {
        id: uid('pp'),
        libraryId,
        amountPaise: PLAN_PRICE_PAISE, // set here, never taken from the browser
        utr: ref,
        status: 'pending',
        failureReason: null,
        submittedAt: nowIso(),
        verifiedAt: null,
      }
      db.planPayments.push(payment)
      commit()
      return payment
    })
  }
  listAll() {
    return run((): AdminPaymentRow[] => {
      requireRole('admin')
      const db = getDb()
      return [...db.planPayments]
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
        .map((p) => {
          const lib = db.libraries.find((l) => l.id === p.libraryId)
          const owner = db.profiles.find((u) => u.id === lib?.ownerId)
          return { ...p, libraryName: lib?.name ?? 'Unknown', ownerName: owner?.name ?? 'Unknown' }
        })
    })
  }
  verify(paymentId: string) {
    return run(() => {
      requireRole('admin')
      const db = getDb()
      const p = db.planPayments.find((x) => x.id === paymentId)
      if (!p) throw new AppError('not_found', 'Payment not found.')
      // A second verify must not add another 30 days.
      if (p.status !== 'pending') throw new AppError('conflict', 'This payment was already handled.')
      const now = getNow()
      const sub = subscriptionOf(p.libraryId)
      const until = extendedActiveUntil(sub, now).toISOString()
      if (sub) sub.activeUntil = until
      else db.subscriptions.push({ libraryId: p.libraryId, trialEndsAt: now.toISOString(), activeUntil: until })
      p.status = 'verified'
      p.verifiedAt = now.toISOString()
      commit()
    })
  }
  fail(paymentId: string, reason: string) {
    return run(() => {
      requireRole('admin')
      const p = getDb().planPayments.find((x) => x.id === paymentId)
      if (!p) throw new AppError('not_found', 'Payment not found.')
      if (p.status !== 'pending') throw new AppError('conflict', 'This payment was already handled.')
      if (!reason.trim()) throw new AppError('invalid', 'Give a reason so the owner knows what to fix.')
      p.status = 'failed'
      p.failureReason = reason.trim()
      commit()
    })
  }
}

// ---------------------------------------------------------------- seats

export class MockSeatRepository implements SeatRepository {
  listByLibrary(libraryId: string) {
    return run((): Seat[] => {
      const user = requireUser()
      const lib = findLibrary(libraryId)
      if (user.role !== 'admin' && lib.ownerId !== user.id) throw new AppError('forbidden', 'Not allowed.')
      return getDb()
        .seats.filter((s) => s.libraryId === libraryId)
        .sort((a, b) => a.seatNumber - b.seatNumber)
    })
  }
  setCapacity(libraryId: string, capacity: number) {
    return run(() => {
      const lib = requireActiveOwner(libraryId)
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
        throw new AppError('invalid', 'Seats must be a whole number between 1 and 500.')
      }
      applyCapacity(lib, capacity)
      commit()
    })
  }
}

// ---------------------------------------------------------------- members

export class MockMemberRepository implements MemberRepository {
  listByLibrary(libraryId: string) {
    return run(() => {
      requireOwner(libraryId)
      return getDb().members.filter((m) => m.libraryId === libraryId)
    })
  }
  add(input: NewMember) {
    return run((): Member => {
      const lib = requireActiveOwner(input.libraryId)
      assertMemberFields(input.name, input.phone)
      if (input.expiryDate < input.startDate) throw new AppError('invalid', 'Expiry must be on or after the start date.')
      const shift = requireActiveShift(lib.id, input.shiftId)
      if (input.seatId) assertSeatFree(lib.id, input.seatId, shift.id)
      if (input.firstFee && input.firstFee.amountPaise <= 0) throw new AppError('invalid', 'Fee must be more than zero.')
      const db = getDb()
      // The same person can join several shifts, but only once per shift.
      if (db.members.some((m) => m.libraryId === lib.id && m.shiftId === shift.id && m.status === 'active' && m.phone === input.phone.trim())) {
        throw new AppError('conflict', `This student is already in ${shift.name}. Add them to a different shift, or renew them.`)
      }
      const member: Member = {
        id: uid('m'),
        libraryId: lib.id,
        studentId: null,
        shiftId: shift.id,
        name: input.name.trim(),
        phone: input.phone.trim(),
        seatId: input.seatId,
        startDate: input.startDate,
        expiryDate: input.expiryDate,
        status: 'active',
        removedAt: null,
      }
      db.members.push(member)
      if (input.firstFee) {
        db.feePayments.push({
          id: uid('fee'), memberId: member.id, libraryId: lib.id, amountPaise: input.firstFee.amountPaise,
          paidOn: todayIST(getNow()), mode: input.firstFee.mode, isVoid: false, voidReason: null,
        })
      }
      commit()
      return member
    })
  }
  update(memberId: string, patch: { name: string; phone: string }) {
    return run((): Member => {
      const m = memberOrThrow(memberId)
      requireActiveOwner(m.libraryId)
      assertMemberFields(patch.name, patch.phone)
      m.name = patch.name.trim()
      m.phone = patch.phone.trim()
      commit()
      return m
    })
  }
  remove(memberId: string) {
    return run(() => {
      const m = memberOrThrow(memberId)
      requireActiveOwner(m.libraryId)
      if (m.status === 'removed') throw new AppError('conflict', 'Already removed.')
      m.status = 'removed'
      m.seatId = null
      m.removedAt = nowIso()
      commit()
    })
  }
  assignSeat(memberId: string, seatId: string | null) {
    return run(() => {
      const m = memberOrThrow(memberId)
      requireActiveOwner(m.libraryId)
      if (m.status !== 'active') throw new AppError('conflict', 'This student was removed.')
      if (seatId) assertSeatFree(m.libraryId, seatId, m.shiftId, m.id)
      m.seatId = seatId
      commit()
    })
  }
  renew(input: RenewInput) {
    return run(() => {
      const m = memberOrThrow(input.memberId)
      requireActiveOwner(m.libraryId)
      if (m.status !== 'active') throw new AppError('conflict', 'This student was removed.')
      if (input.amountPaise <= 0) throw new AppError('invalid', 'Fee must be more than zero.')
      if (input.newExpiry <= m.expiryDate) throw new AppError('invalid', 'New expiry must be after the current expiry.')
      getDb().feePayments.push({
        id: uid('fee'), memberId: m.id, libraryId: m.libraryId, amountPaise: input.amountPaise,
        paidOn: todayIST(getNow()), mode: input.mode, isVoid: false, voidReason: null,
      })
      m.expiryDate = input.newExpiry
      commit()
    })
  }
  listMine() {
    return run((): MyMembership[] => {
      const user = requireRole('student')
      const db = getDb()
      return db.members
        .filter((m) => m.studentId === user.id && m.status === 'active')
        .map((member) => {
          const lib = db.libraries.find((l) => l.id === member.libraryId)
          return {
            member,
            shift: db.shifts.find((s) => s.id === member.shiftId) ?? null,
            library: lib ? toPublic(lib) : null,
            seatNumber: db.seats.find((s) => s.id === member.seatId)?.seatNumber ?? null,
            payments: db.feePayments
              .filter((f) => f.memberId === member.id)
              .sort((a, b) => b.paidOn.localeCompare(a.paidOn)),
          }
        })
    })
  }
}

// ---------------------------------------------------------------- fees

export class MockFeeRepository implements FeeRepository {
  listByLibrary(libraryId: string) {
    return run(() => {
      requireOwner(libraryId)
      return getDb().feePayments.filter((f) => f.libraryId === libraryId)
    })
  }
  listByMember(memberId: string): Promise<FeePayment[]> {
    return run(() => {
      const user = requireUser()
      const m = memberOrThrow(memberId)
      const lib = findLibrary(m.libraryId)
      if (lib.ownerId !== user.id && m.studentId !== user.id && user.role !== 'admin') {
        throw new AppError('forbidden', 'Not allowed.')
      }
      return getDb()
        .feePayments.filter((f) => f.memberId === memberId)
        .sort((a, b) => b.paidOn.localeCompare(a.paidOn))
    })
  }
  record(input: { memberId: string; amountPaise: number; paidOn: string; mode: FeePayment['mode'] }) {
    return run((): FeePayment => {
      const m = memberOrThrow(input.memberId)
      requireActiveOwner(m.libraryId)
      if (input.amountPaise <= 0) throw new AppError('invalid', 'Fee must be more than zero.')
      const fee: FeePayment = {
        id: uid('fee'), memberId: m.id, libraryId: m.libraryId, amountPaise: input.amountPaise,
        paidOn: input.paidOn, mode: input.mode, isVoid: false, voidReason: null,
      }
      getDb().feePayments.push(fee)
      commit()
      return fee
    })
  }
  void(feeId: string, reason: string) {
    return run(() => {
      const fee = getDb().feePayments.find((f) => f.id === feeId)
      if (!fee) throw new AppError('not_found', 'Payment not found.')
      requireActiveOwner(fee.libraryId)
      if (fee.isVoid) throw new AppError('conflict', 'Already voided.')
      if (!reason.trim()) throw new AppError('invalid', 'Give a reason for voiding.')
      fee.isVoid = true
      fee.voidReason = reason.trim()
      commit()
    })
  }
}

// ---------------------------------------------------------------- seat requests

export class MockSeatRequestRepository implements SeatRequestRepository {
  create(libraryId: string, shiftId: string) {
    return run((): SeatRequest => {
      const user = requireRole('student')
      const db = getDb()
      const lib = db.libraries.find((l) => l.id === libraryId)
      if (!lib || !isLibraryActive(lib)) throw new AppError('not_found', 'This library is not accepting requests.')
      const shift = requireActiveShift(libraryId, shiftId)
      // One request per shift: a student can ask for Morning and Evening separately.
      if (db.seatRequests.some((r) => r.studentId === user.id && r.shiftId === shiftId && r.status === 'pending')) {
        throw new AppError('conflict', `You already asked for a seat in ${shift.name}.`)
      }
      if (db.members.some((m) => m.studentId === user.id && m.shiftId === shiftId && m.status === 'active')) {
        throw new AppError('conflict', `You are already a member of ${shift.name} here.`)
      }
      const req: SeatRequest = {
        id: uid('sr'), studentId: user.id, studentName: user.name, studentPhone: user.phone,
        libraryId, shiftId, status: 'pending', createdAt: nowIso(), decidedAt: null,
      }
      db.seatRequests.push(req)
      commit()
      return req
    })
  }
  cancel(requestId: string) {
    return run(() => {
      const user = requireRole('student')
      const r = getDb().seatRequests.find((x) => x.id === requestId && x.studentId === user.id)
      if (!r) throw new AppError('not_found', 'Request not found.')
      if (r.status !== 'pending') throw new AppError('conflict', 'Only a pending request can be cancelled.')
      r.status = 'cancelled'
      r.decidedAt = nowIso()
      commit()
    })
  }
  listMine() {
    return run((): MySeatRequest[] => {
      const user = requireRole('student')
      const db = getDb()
      return db.seatRequests
        .filter((r) => r.studentId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((r) => {
          const lib = findLibrary(r.libraryId)
          return {
            ...r,
            libraryName: lib.name,
            areaName: db.areas.find((a) => a.id === lib.areaId)?.name ?? '',
            cityName: db.cities.find((c) => c.id === lib.cityId)?.name ?? '',
            shiftName: db.shifts.find((s) => s.id === r.shiftId)?.name ?? '',
          }
        })
    })
  }
  listByLibrary(libraryId: string) {
    return run(() => {
      requireOwner(libraryId)
      return getDb()
        .seatRequests.filter((r) => r.libraryId === libraryId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    })
  }
  approve(input: ApproveRequestInput) {
    return run(() => {
      const db = getDb()
      const req = db.seatRequests.find((r) => r.id === input.requestId)
      if (!req) throw new AppError('not_found', 'Request not found.')
      const lib = requireActiveOwner(req.libraryId)
      if (req.status !== 'pending') throw new AppError('conflict', 'This request was already handled.')
      if (input.expiryDate < input.startDate) throw new AppError('invalid', 'Expiry must be on or after the start date.')
      assertSeatFree(lib.id, input.seatId, req.shiftId)
      // Everything below happens together or not at all (the SQL function runs in one transaction).
      const member: Member = {
        id: uid('m'), libraryId: lib.id, studentId: req.studentId, shiftId: req.shiftId, name: req.studentName, phone: req.studentPhone,
        seatId: input.seatId, startDate: input.startDate, expiryDate: input.expiryDate, status: 'active', removedAt: null,
      }
      db.members.push(member)
      if (input.amountPaise > 0) {
        db.feePayments.push({
          id: uid('fee'), memberId: member.id, libraryId: lib.id, amountPaise: input.amountPaise,
          paidOn: todayIST(getNow()), mode: input.mode, isVoid: false, voidReason: null,
        })
      }
      req.status = 'approved'
      req.decidedAt = nowIso()
      commit()
    })
  }
  reject(requestId: string) {
    return run(() => {
      const req = getDb().seatRequests.find((r) => r.id === requestId)
      if (!req) throw new AppError('not_found', 'Request not found.')
      requireActiveOwner(req.libraryId)
      if (req.status !== 'pending') throw new AppError('conflict', 'This request was already handled.')
      req.status = 'rejected'
      req.decidedAt = nowIso()
      commit()
    })
  }
}

