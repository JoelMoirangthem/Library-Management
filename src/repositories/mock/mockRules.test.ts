import { beforeEach, describe, expect, it } from 'vitest'
import { AppError } from '@/domain/errors'
import { devFlags, setClockOffsetDays } from '@/lib/devState'
import { getDb, resetMockData } from '@/repositories/mock/db'
import {
  MockDemoLogin,
  MockLibraryRepository,
  MockMemberRepository,
  MockAuthRepository,
  MockPlanPaymentRepository,
  MockSeatRequestRepository,
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
        members.add({ libraryId: 'lib_scholars', name: 'New Student', phone: '9876543210', seatId: null, startDate: '2026-10-01', expiryDate: '2026-11-01' }),
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
    const taken = getDb().members.find((m) => m.libraryId === 'lib_gyan' && m.status === 'active' && m.seatId)!
    expect(
      await code(
        members.add({ libraryId: 'lib_gyan', name: 'Dup Seat', phone: '9876543210', seatId: taken.seatId, startDate: '2026-10-01', expiryDate: '2026-11-01' }),
      ),
    ).toBe('conflict')
  })

  it('a student cannot request twice at the same library', async () => {
    await login.signInAs('u_aman')
    expect(await code(requests.create('lib_gyan'))).toBe('conflict') // seeded pending
    expect(await code(requests.create('lib_scholars'))).toBe('not_found') // expired
  })

  it('approving a request creates the member, seat and fee together', async () => {
    await login.signInAs('u_anil')
    const free = getDb().seats.find(
      (s) => s.libraryId === 'lib_gyan' && s.isActive && !getDb().members.some((m) => m.seatId === s.id && m.status === 'active'),
    )!
    await requests.approve({ requestId: 'sr_1', seatId: free.id, startDate: '2026-10-17', expiryDate: '2026-11-16', amountPaise: 100000, mode: 'cash' })
    const m = getDb().members.find((x) => x.studentId === 'u_aman' && x.libraryId === 'lib_gyan')!
    expect(m.seatId).toBe(free.id)
    expect(getDb().feePayments.some((f) => f.memberId === m.id && f.amountPaise === 100000)).toBe(true)
    expect(getDb().seatRequests.find((r) => r.id === 'sr_1')!.status).toBe('approved')
    expect(await code(requests.approve({ requestId: 'sr_1', seatId: free.id, startDate: '2026-10-17', expiryDate: '2026-11-16', amountPaise: 0, mode: 'cash' }))).toBe('conflict')
  })

  it('lowering seats only deactivates free seats', async () => {
    await login.signInAs('u_anil')
    expect(await code(seats.setCapacity('lib_gyan', 5))).toBe('conflict')
    await seats.setCapacity('lib_gyan', 35)
    expect(getDb().seats.filter((s) => s.libraryId === 'lib_gyan' && s.isActive)).toHaveLength(35)
  })
})

describe('renewals', () => {
  it('renew records the fee and extends expiry together; removed members cannot renew', async () => {
    await login.signInAs('u_anil')
    const m = getDb().members.find((x) => x.id === 'lib_gyan_m3')!
    const old = m.expiryDate
    await members.renew({ memberId: m.id, amountPaise: 100000, mode: 'upi', newExpiry: '2099-01-01' })
    expect(m.expiryDate).toBe('2099-01-01')
    expect(old < m.expiryDate).toBe(true)
    expect(await code(members.renew({ memberId: 'lib_gyan_mr', amountPaise: 100000, mode: 'cash', newExpiry: '2099-02-01' }))).toBe('conflict')
  })
})
