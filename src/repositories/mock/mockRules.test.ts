import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@/domain/errors'
import { devFlags, setClockOffsetDays } from '@/lib/devState'
import { getDb, resetMockData } from '@/repositories/mock/db'
import type { Library, LibraryInput } from '@/domain/types'
import {
  MockCatalogRepository,
  MockDemoLogin,
  MockLibraryRepository,
  MockMemberRepository,
  MockAuthRepository,
  MockPlanPaymentRepository,
  MockSeatRequestRepository,
  MockShiftRepository,
  MockSubscriptionRepository,
  MockSeatRepository,
} from '@/repositories/mock/mockRepos'

/** These mirror the "must fail / must hold" list in docs/DATABASE.md, against the mock. */

const login = new MockDemoLogin()
const libs = new MockLibraryRepository()
const members = new MockMemberRepository()
const payments = new MockPlanPaymentRepository()
const requests = new MockSeatRequestRepository()
const subs = new MockSubscriptionRepository()
const seats = new MockSeatRepository()
const shiftRepo = new MockShiftRepository()
const auth = new MockAuthRepository()

const code = async (p: Promise<unknown>) => {
  try {
    await p
    return 'ok'
  } catch (e) {
    return e instanceof AppError ? e.code : 'other'
  }
}

beforeEach(() => {
  devFlags.set({ latencyMs: 0, forceLoading: false, forceError: false })
  setClockOffsetDays(0)
  resetMockData()
})

describe('isolation between owners', () => {
  it("owner A cannot read or change owner B's data", async () => {
    await login.signInAs('u_sunita') // owns lib_nalanda
    expect(await code(members.listByLibrary('lib_gyan'))).toBe('forbidden')
    expect(await code(subs.getByLibrary('lib_gyan'))).toBe('forbidden')
    expect(await code(seats.setCapacity('lib_gyan', 10))).toBe('forbidden')
    expect(await code(payments.submit('lib_gyan', '999999999999'))).toBe('forbidden')
  })

  it('students cannot reach owner data', async () => {
    await login.signInAs('u_aman')
    expect(await code(members.listByLibrary('lib_gyan'))).toBe('forbidden')
  })
})

describe('roles', () => {
  it('a role can be chosen once and never changed', async () => {
    await login.signUpNewUser('Test User', 't@x.com')
    await auth.setMyRole('owner')
    expect(await code(auth.setMyRole('student'))).toBe('conflict')
  })

  it('only admin can approve, verify or manage cities', async () => {
    await login.signInAs('u_deepak')
    expect(await code(libs.approve('lib_lakshya'))).toBe('forbidden')
    expect(await code(payments.verify('pp_3'))).toBe('forbidden')
  })
})

describe('plan payments (BR-4, BR-5)', () => {
  it('after the plan expired, counts the 30 days from the day the admin activates it', async () => {
    // lib_scholars' plan ended 5 days ago. The owner pays now; the admin only activates it 3 days later.
    await login.signInAs('u_farah')
    const payment = await payments.submit('lib_scholars', '555000111222')
    setClockOffsetDays(3)
    await login.signInAs('u_admin')
    await payments.verify(payment.id)
    const end = new Date(getDb().subscriptions.find((s) => s.libraryId === 'lib_scholars')!.activeUntil).getTime()
    const activatedAt = Date.now() + 3 * 86_400_000
    expect(Math.abs(end - (activatedAt + 30 * 86_400_000))).toBeLessThan(5_000)
  })

  it('paid in advance with days left: those days stack, even if verified later', async () => {
    await login.signInAs('u_manoj')
    const before = new Date(getDb().subscriptions.find((s) => s.libraryId === 'lib_quiet')!.activeUntil).getTime()
    await login.signInAs('u_admin')
    await payments.verify('pp_3')
    const end = new Date(getDb().subscriptions.find((s) => s.libraryId === 'lib_quiet')!.activeUntil).getTime()
    expect(Math.abs(end - (before + 30 * 86_400_000))).toBeLessThan(5_000)
  })

  it('keeps the days left when the owner paid while still active, even if verified after the plan ended', async () => {
    // lib_quiet has about 1.5 days left. The owner pays now; the admin verifies 4 days later (after it ended).
    await login.signInAs('u_manoj')
    const before = new Date(getDb().subscriptions.find((s) => s.libraryId === 'lib_quiet')!.activeUntil).getTime()
    const submitted = getDb().planPayments.find((p) => p.id === 'pp_3')!
    setClockOffsetDays(4)
    await login.signInAs('u_admin')
    await payments.verify(submitted.id)
    const end = new Date(getDb().subscriptions.find((s) => s.libraryId === 'lib_quiet')!.activeUntil).getTime()
    expect(Math.abs(end - (before + 30 * 86_400_000))).toBeLessThan(5_000)
  })

  it('verifying twice adds 30 days once', async () => {
    await login.signInAs('u_admin')
    const before = new Date(getDb().subscriptions.find((s) => s.libraryId === 'lib_quiet')!.activeUntil).getTime()
    await payments.verify('pp_3')
    const after = new Date(getDb().subscriptions.find((s) => s.libraryId === 'lib_quiet')!.activeUntil).getTime()
    expect((after - before) / 86_400_000).toBeCloseTo(30)
    expect(await code(payments.verify('pp_3'))).toBe('conflict')
    const again = new Date(getDb().subscriptions.find((s) => s.libraryId === 'lib_quiet')!.activeUntil).getTime()
    expect(again).toBe(after)
  })

  it('a UTR can only be used once and must be 12 digits', async () => {
    await login.signInAs('u_anil')
    expect(await code(payments.submit('lib_gyan', '123'))).toBe('invalid')
    expect(await code(payments.submit('lib_gyan', '412345678901'))).toBe('conflict') // used by lib_nalanda
    expect(await code(payments.submit('lib_gyan', '555555555555'))).toBe('ok')
    expect(await code(payments.submit('lib_gyan', '666666666666'))).toBe('conflict') // one pending at a time
  })

  it('the amount is fixed by the database', async () => {
    await login.signInAs('u_anil')
    const p = await payments.submit('lib_gyan', '555555555555')
    expect(p.amountPaise).toBe(19900)
  })
})

describe('approval and trial (BR-3)', () => {
  it('approval starts a 14-day trial and creates seats', async () => {
    await login.signInAs('u_admin')
    await libs.approve('lib_lakshya')
    const sub = getDb().subscriptions.find((s) => s.libraryId === 'lib_lakshya')!
    expect((new Date(sub.activeUntil).getTime() - Date.now()) / 86_400_000).toBeCloseTo(14, 1)
    expect(getDb().seats.filter((s) => s.libraryId === 'lib_lakshya')).toHaveLength(36)
  })

  it('a rejected library can be fixed and resubmitted, and approval never restarts a trial', async () => {
    await login.signInAs('u_rekha')
    await libs.submitForReview('lib_nest')
    await login.signInAs('u_admin')
    await libs.approve('lib_nest')
    const first = getDb().subscriptions.find((s) => s.libraryId === 'lib_nest')!.activeUntil
    expect(await code(libs.approve('lib_nest'))).toBe('conflict')
    expect(getDb().subscriptions.find((s) => s.libraryId === 'lib_nest')!.activeUntil).toBe(first)
  })
})

describe('expired library is read-only (BR-6)', () => {
  it('blocks writes, allows reads, and still accepts a plan payment', async () => {
    await login.signInAs('u_farah') // lib_scholars is expired
    expect(await code(members.listByLibrary('lib_scholars'))).toBe('ok')
    expect(
      await code(
        members.add({ libraryId: 'lib_scholars', shiftId: 'lib_scholars_sh1', name: 'New Student', phone: '9876543210', seatId: null, startDate: '2026-10-01', expiryDate: '2026-11-01' }),
      ),
    ).toBe('forbidden')
    expect(await code(payments.submit('lib_scholars', '777777777777'))).toBe('ok')
  })

  it('an expired library disappears from public search', async () => {
    await login.signInAs('u_aman')
    const ids = (await libs.searchPublic({})).map((l) => l.id)
    expect(ids).not.toContain('lib_scholars')
    expect(ids).not.toContain('lib_lakshya')
    expect(ids).not.toContain('lib_nest')
    expect(ids).toContain('lib_gyan')
  })

  it('moving the clock past the trial hides the library', async () => {
    await login.signInAs('u_aman')
    setClockOffsetDays(10)
    const ids = (await libs.searchPublic({})).map((l) => l.id)
    expect(ids).not.toContain('lib_gyan')
  })
})

describe('seats and requests', () => {
  it('one seat cannot hold two active members', async () => {
    await login.signInAs('u_anil')
    const taken = getDb().members.find((m) => m.shiftId === 'lib_gyan_sh1' && m.status === 'active' && m.seatId)!
    expect(
      await code(
        members.add({ libraryId: 'lib_gyan', shiftId: 'lib_gyan_sh1', name: 'Dup Seat', phone: '9876543210', seatId: taken.seatId, startDate: '2026-10-01', expiryDate: '2026-11-01' }),
      ),
    ).toBe('conflict')
  })

  it('a student cannot request twice at the same library', async () => {
    await login.signInAs('u_aman')
    expect(await code(requests.create('lib_gyan', 'lib_gyan_sh2'))).toBe('conflict') // seeded pending
    expect(await code(requests.create('lib_scholars', 'lib_scholars_sh1'))).toBe('not_found') // expired
  })

  it('approving a request creates the member, seat and fee together', async () => {
    await login.signInAs('u_anil')
    const free = getDb().seats.find(
      (s) => s.libraryId === 'lib_gyan' && s.isActive && !getDb().members.some((m) => m.seatId === s.id && m.shiftId === 'lib_gyan_sh2' && m.status === 'active'),
    )!
    await requests.approve({ requestId: 'sr_1', seatId: free.id, startDate: '2026-10-17', expiryDate: '2026-11-16', amountPaise: 100000, mode: 'cash' })
    const m = getDb().members.find((x) => x.studentId === 'u_aman' && x.libraryId === 'lib_gyan')!
    expect(m.seatId).toBe(free.id)
    expect(getDb().feePayments.some((f) => f.memberId === m.id && f.amountPaise === 100000)).toBe(true)
    expect(getDb().seatRequests.find((r) => r.id === 'sr_1')!.status).toBe('approved')
    expect(await code(requests.approve({ requestId: 'sr_1', seatId: free.id, startDate: '2026-10-17', expiryDate: '2026-11-16', amountPaise: 0, mode: 'cash' }))).toBe('conflict')
  })

  it('lowering seats only deactivates seats free in every shift', async () => {
    await login.signInAs('u_anil')
    // Morning is completely full, so no seat can be removed.
    expect(await code(seats.setCapacity('lib_gyan', 35))).toBe('conflict')
    await login.signInAs('u_sunita')
    await seats.setCapacity('lib_nalanda', 25)
    expect(getDb().seats.filter((s) => s.libraryId === 'lib_nalanda' && s.isActive)).toHaveLength(25)
  })
})

describe('renewals', () => {
  it('renew records the fee and extends expiry together; removed members cannot renew', async () => {
    await login.signInAs('u_anil')
    const m = getDb().members.find((x) => x.id === 'lib_gyan_sh1_m3')!
    const old = m.expiryDate
    await members.renew({ memberId: m.id, amountPaise: 100000, mode: 'upi', newExpiry: '2099-01-01' })
    expect(m.expiryDate).toBe('2099-01-01')
    expect(old < m.expiryDate).toBe(true)
    expect(await code(members.renew({ memberId: 'lib_gyan_mr', amountPaise: 100000, mode: 'cash', newExpiry: '2099-02-01' }))).toBe('conflict')
  })
})

describe('shifts', () => {
  it('a full morning leaves the other shifts completely free', async () => {
    await login.signInAs('u_aman')
    const gyan = (await libs.searchPublic({})).find((l) => l.id === 'lib_gyan')!
    const [morning, afternoon, evening] = gyan.shifts
    expect(morning.name).toBe('Morning')
    expect(morning.seatsLeft).toBe(0)
    expect(afternoon.seatsLeft).toBeGreaterThan(25)
    expect(evening.seatsLeft).toBeGreaterThan(25)
    expect(gyan.fromFeePaise).toBe(70000) // cheapest shift
  })

  it('the same seat can hold a different student in each shift, but only one per shift', async () => {
    await login.signInAs('u_anil')
    const seatId = 'lib_gyan_s39' // held in Morning, empty in Afternoon
    const base = { libraryId: 'lib_gyan', seatId, startDate: '2026-10-01', expiryDate: '2026-11-01' }
    expect(await code(members.add({ ...base, shiftId: 'lib_gyan_sh2', name: 'Afternoon Student', phone: '9111111111' }))).toBe('ok')
    expect(await code(members.add({ ...base, shiftId: 'lib_gyan_sh2', name: 'Another One', phone: '9222222222' }))).toBe('conflict')
    expect(await code(members.add({ ...base, shiftId: 'lib_gyan_sh1', name: 'Morning Clash', phone: '9333333333' }))).toBe('conflict')
  })

  it('one student can join several shifts, but not the same shift twice', async () => {
    await login.signInAs('u_anil')
    const base = { libraryId: 'lib_gyan', seatId: null, startDate: '2026-10-01', expiryDate: '2026-11-01', name: 'Twice Student', phone: '9444444444' }
    expect(await code(members.add({ ...base, shiftId: 'lib_gyan_sh2' }))).toBe('ok')
    expect(await code(members.add({ ...base, shiftId: 'lib_gyan_sh3' }))).toBe('ok')
    expect(await code(members.add({ ...base, shiftId: 'lib_gyan_sh3' }))).toBe('conflict')
    await login.signInAs('u_riya')
    expect(await members.listMine()).toHaveLength(2) // Morning and Evening, each its own membership
  })

  it('requests are per shift', async () => {
    await login.signInAs('u_aman')
    expect(await code(requests.create('lib_gyan', 'lib_gyan_sh3'))).toBe('ok') // already pending for sh2
    expect(await code(requests.create('lib_gyan', 'lib_gyan_sh3'))).toBe('conflict')
    expect(await code(requests.create('lib_gyan', 'lib_nalanda_sh1'))).toBe('invalid') // shift of another library
  })

  it('shifts cannot overlap and there are at most three', async () => {
    await login.signInAs('u_manoj') // Day 06:00-18:00 and Night 18:00-06:00 cover the whole day
    expect(await code(shiftRepo.add('lib_quiet', { name: 'Early', startTime: '05:00', endTime: '07:00', monthlyFeePaise: 50000 }))).toBe('invalid')
    await login.signInAs('u_rekha') // Study Nest has one shift
    expect(await code(shiftRepo.add('lib_nest', { name: 'Afternoon', startTime: '13:00', endTime: '17:00', monthlyFeePaise: 50000 }))).toBe('ok')
    expect(await code(shiftRepo.add('lib_nest', { name: 'Evening', startTime: '18:00', endTime: '21:00', monthlyFeePaise: 50000 }))).toBe('ok')
    expect(await code(shiftRepo.add('lib_nest', { name: 'Late', startTime: '21:30', endTime: '23:00', monthlyFeePaise: 50000 }))).toBe('conflict')
  })

  it('switching a shift off never deletes it or its students', async () => {
    await login.signInAs('u_anil')
    const before = getDb().members.filter((m) => m.shiftId === 'lib_gyan_sh3' && m.status === 'active').length
    await shiftRepo.setActive('lib_gyan_sh3', false)
    expect(getDb().shifts.find((s) => s.id === 'lib_gyan_sh3')!.isActive).toBe(false)
    expect(getDb().members.filter((m) => m.shiftId === 'lib_gyan_sh3' && m.status === 'active')).toHaveLength(before)
    await login.signInAs('u_sana')
    expect((await libs.getPublic('lib_gyan'))!.shifts.map((s) => s.id)).not.toContain('lib_gyan_sh3')
    expect(await code(requests.create('lib_gyan', 'lib_gyan_sh3'))).toBe('invalid')
  })

  it('the last shift cannot be switched off', async () => {
    await login.signInAs('u_rekha')
    expect(await code(shiftRepo.setActive('lib_nest_sh1', false))).toBe('conflict')
  })

  it('an expired owner cannot change shifts', async () => {
    await login.signInAs('u_farah')
    expect(await code(shiftRepo.add('lib_scholars', { name: 'Evening', startTime: '18:00', endTime: '21:00', monthlyFeePaise: 50000 }))).toBe('forbidden')
  })
})

describe('admin badge counts (the menu badges must not need the full lists)', () => {
  it('counts the libraries waiting for review, and agrees with the full list', async () => {
    await login.signInAs('u_admin')
    const n = await libs.countPendingForAdmin()
    const listed = (await libs.listForAdmin()).filter((r) => r.library.approvalStatus === 'pending').length
    expect(n).toBe(listed)
  })

  it('counts the plan payments waiting for a check, and agrees with the full list', async () => {
    await login.signInAs('u_admin')
    const n = await payments.countPendingForAdmin()
    const listed = (await payments.listAll()).filter((p) => p.status === 'pending').length
    expect(n).toBe(listed)
    expect(n).toBeGreaterThan(0)
  })

  it('only an admin may ask', async () => {
    await login.signInAs('u_manoj')
    await expect(libs.countPendingForAdmin()).rejects.toBeInstanceOf(AppError)
    await expect(payments.countPendingForAdmin()).rejects.toBeInstanceOf(AppError)
  })
})

describe('places: state, district, town and area', () => {
  const catalog = new MockCatalogRepository()
  const shifts = [{ name: 'Day', startTime: '09:00', endTime: '17:00', monthlyFeePaise: 50000 }]
  const input = (p: Partial<LibraryInput>): LibraryInput => ({
    name: 'New Lib', stateId: 'S9', districtId: 'D157', cityId: 'C249286', area: '', address: 'Mall Road',
    landmark: '', pincode: '208001', phone: '9415000011', capacity: 10, timings: '9 to 9', amenities: [], photos: [], ...p,
  })

  it('lists every state, the districts of a state, and the towns of a district', async () => {
    expect(await catalog.listStates()).toHaveLength(36)
    expect((await catalog.listDistricts('S9')).map((d) => d.name)).toContain('Lucknow')
    const towns = await catalog.listCities({ districtId: 'D162' })
    expect(towns.map((t) => t.name)).toEqual(expect.arrayContaining(['Lucknow', 'Kakori', 'Malihabad']))
    // Imphal lies in two districts and is listed under both.
    expect((await catalog.listCities({ districtId: 'D255' })).map((t) => t.name)).toContain('Imphal')
    expect((await catalog.listCities({ districtId: 'D256' })).map((t) => t.name)).toContain('Imphal')
  })

  it('a new owner lists a library with no area; a town outside the district is refused', async () => {
    await login.signUpNewUser('New Owner', 'new.owner@gmail.com')
    await auth.setMyRole('owner')
    expect(await code(libs.create(input({ districtId: 'D162' }), shifts))).toBe('invalid') // Kanpur is not in Lucknow district
    expect(await code(libs.create(input({ stateId: 'S14' }), shifts))).toBe('invalid') // Kanpur Nagar is not in Manipur
    const lib = await libs.create(input({}), shifts)
    expect(lib.area).toBe('')
  })

  it('search narrows by state and by district', async () => {
    const all = await libs.searchPublic({})
    const up = await libs.searchPublic({ stateId: 'S9' })
    const lucknow = await libs.searchPublic({ districtId: 'D162' })
    const manipur = await libs.searchPublic({ stateId: 'S14' })
    expect(lucknow.length).toBeGreaterThan(0)
    expect(lucknow.every((l) => l.districtName === 'Lucknow' && l.stateName === 'Uttar Pradesh')).toBe(true)
    expect(manipur.map((l) => l.cityName)).toEqual(['Imphal'])
    expect(up.length + manipur.length).toBe(all.length)
  })

  it('only an admin adds a town, and not one that already exists in the state', async () => {
    await login.signInAs('u_anil')
    expect(await code(catalog.addCity('D162', 'Chinhat'))).toBe('forbidden')
    await login.signInAs('u_admin')
    const town = await catalog.addCity('D162', '  Chinhat  ')
    expect(town).toMatchObject({ name: 'Chinhat', stateId: 'S9', isActive: true })
    expect((await catalog.listCities({ districtId: 'D162' })).map((t) => t.name)).toContain('Chinhat')
    expect(await code(catalog.addCity('D157', 'lucknow'))).toBe('conflict')
  })

  it('switching a town off hides it from owners and its libraries from search', async () => {
    await login.signInAs('u_admin')
    await catalog.setCityActive('C276547', false) // Imphal
    expect((await catalog.listCities({ districtId: 'D256' })).map((t) => t.name)).not.toContain('Imphal')
    expect((await catalog.listCities({ districtId: 'D256', includeInactive: true })).map((t) => t.name)).toContain('Imphal')
    expect(await libs.searchPublic({ stateId: 'S14' })).toEqual([])
  })
})

describe('typed area (D-045)', () => {
  const catalog = new MockCatalogRepository()
  const LUCKNOW = 'C249234'
  const KANPUR = 'C249286'
  const shifts = [{ name: 'Day', startTime: '09:00', endTime: '17:00', monthlyFeePaise: 50000 }]
  const input = (over: Partial<LibraryInput> = {}): LibraryInput => ({
    name: 'Hazrat Reading Room', stateId: 'S9', districtId: 'D162', cityId: LUCKNOW, area: '  Hazratganj   Market ',
    address: '1 MG Road', landmark: '', pincode: '226001', phone: '9876543210', capacity: 10, timings: '9 to 9',
    amenities: [], photos: [], ...over,
  })
  const asInput = (l: Library): LibraryInput => ({
    name: l.name, stateId: l.stateId, districtId: l.districtId, cityId: l.cityId, area: l.area, address: l.address,
    landmark: l.landmark, pincode: l.pincode, phone: l.phone, capacity: l.capacity, timings: l.timings,
    amenities: l.amenities, photos: l.photos,
  })

  async function newOwner() {
    await login.signUpNewUser('New Owner', 'new.owner@gmail.com')
    await auth.setMyRole('owner')
  }

  it('an owner types any area, and it is saved tidied', async () => {
    await newOwner()
    const lib = await libs.create(input(), shifts)
    expect(lib.area).toBe('Hazratganj Market')
  })

  it('the area stays optional', async () => {
    await newOwner()
    expect((await libs.create(input({ area: '   ' }), shifts)).area).toBe('')
  })

  it('an area longer than 60 characters is refused', async () => {
    await newOwner()
    expect(await code(libs.create(input({ area: 'a'.repeat(61) }), shifts))).toBe('invalid')
  })

  it('editing the library changes the typed area and tidies it', async () => {
    await login.signInAs('u_anil')
    const mine = (await libs.getMine())!
    const saved = await libs.update(mine.id, { ...asInput(mine), area: ' Hazratganj   Market ' })
    expect(saved.area).toBe('Hazratganj Market')
    expect((await libs.getMine())!.area).toBe('Hazratganj Market')
  })

  it('students, admins and seat requests show the typed area', async () => {
    await login.signInAs('u_aman')
    expect((await libs.searchPublic({})).find((l) => l.id === 'lib_gyan')!.areaName).toBe('Faizabad Road')
    expect((await requests.listMine()).find((r) => r.libraryId === 'lib_gyan')!.areaName).toBe('Faizabad Road')
    await login.signInAs('u_admin')
    expect((await libs.listForAdmin()).find((r) => r.library.id === 'lib_gyan')!.areaName).toBe('Faizabad Road')
  })

  it('search by area ignores case and extra spaces', async () => {
    await login.signInAs('u_aman')
    const ids = (await libs.searchPublic({ cityId: LUCKNOW, area: '  faizabad   ROAD' })).map((l) => l.id)
    expect(ids).toEqual(['lib_gyan'])
  })

  it('a library with no area is still found by its town, but not by an area', async () => {
    await login.signInAs('u_sunita')
    const nalanda = (await libs.getMine())!
    await libs.update(nalanda.id, { ...asInput(nalanda), area: '' })
    await login.signInAs('u_aman')
    expect((await libs.searchPublic({ cityId: LUCKNOW })).map((l) => l.id)).toContain('lib_nalanda')
    expect((await libs.searchPublic({ area: 'Aliganj' })).map((l) => l.id)).not.toContain('lib_nalanda')
  })

  it('switching an admin area off no longer hides libraries', async () => {
    await login.signInAs('u_admin')
    await catalog.setAreaActive('area_faz', false)
    await login.signInAs('u_aman')
    expect((await libs.searchPublic({ area: 'Faizabad Road' })).map((l) => l.id)).toEqual(['lib_gyan'])
  })

  describe('the area list on Discover (listAreaNames)', () => {
    it('lists the admin areas of the town plus areas libraries typed, once each', async () => {
      await login.signInAs('u_anil')
      const gyan = (await libs.getMine())!
      await libs.update(gyan.id, { ...asInput(gyan), area: 'Hazratganj Market' })
      await login.signInAs('u_sunita')
      const nalanda = (await libs.getMine())!
      await libs.update(nalanda.id, { ...asInput(nalanda), area: 'aliganj' }) // the admin list says "Aliganj"
      const names = await catalog.listAreaNames(LUCKNOW)
      expect(names.filter((n) => n.toLowerCase() === 'aliganj')).toEqual(['Aliganj'])
      expect(names).toContain('Hazratganj Market')
      expect(names).not.toContain('Swaroop Nagar') // that is Kanpur
    })

    it('adds a typed area only once students can find the library', async () => {
      await newOwner()
      const lib = await libs.create(input({ area: 'Brand New Colony' }), shifts) // waits for approval
      expect(await catalog.listAreaNames(LUCKNOW)).not.toContain('Brand New Colony')
      await login.signInAs('u_admin')
      await libs.approve(lib.id)
      expect(await catalog.listAreaNames(LUCKNOW)).toContain('Brand New Colony')
    })

    it('drops an admin area once it is switched off', async () => {
      await login.signInAs('u_admin')
      expect(await catalog.listAreaNames(KANPUR)).toContain('Kakadeo')
      await catalog.setAreaActive('area_kak', false) // no library uses it
      expect(await catalog.listAreaNames(KANPUR)).not.toContain('Kakadeo')
    })

    it('is empty for a town with no areas and no libraries', async () => {
      expect(await catalog.listAreaNames('C000000')).toEqual([])
    })
  })
})
