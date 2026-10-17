import { addDays, todayIST } from '@/domain/dates'
import type {
  Area,
  City,
  FeePayment,
  Library,
  Member,
  PlanPayment,
  Profile,
  Seat,
  SeatRequest,
  Shift,
  Subscription,
} from '@/domain/types'

export type DB = {
  version: number
  sessionUserId: string | null
  cities: City[]
  areas: Area[]
  profiles: Profile[]
  libraries: Library[]
  shifts: Shift[]
  subscriptions: Subscription[]
  planPayments: PlanPayment[]
  seats: Seat[]
  members: Member[]
  feePayments: FeePayment[]
  seatRequests: SeatRequest[]
}

export const DB_VERSION = 2

const DAY = 86_400_000
const FIRST = ['Aarav', 'Ishita', 'Kabir', 'Meera', 'Rohan', 'Ananya', 'Vivek', 'Priya', 'Arjun', 'Neha', 'Siddharth', 'Pooja', 'Harsh', 'Kavya', 'Nikhil', 'Shreya']
const LAST = ['Mishra', 'Verma', 'Singh', 'Pandey', 'Tiwari', 'Dubey', 'Yadav', 'Nair', 'Chauhan', 'Kapoor', 'Rao', 'Saxena']

function personName(i: number): string {
  return `${FIRST[i % FIRST.length]} ${LAST[(i * 7 + Math.floor(i / FIRST.length)) % LAST.length]}`
}

function phone(n: number): string {
  return `9${String(800000000 + n * 7919).slice(0, 9)}`
}

/** Builds the starting dataset. Everything is relative to `now` so every state is visible on day one. */
export function createSeed(now: Date): DB {
  const today = todayIST(now)
  const iso = (days: number) => new Date(now.getTime() + days * DAY).toISOString()
  const date = (days: number) => addDays(today, days)

  const cities: City[] = [
    { id: 'city_lko', name: 'Lucknow', isActive: true },
    { id: 'city_knp', name: 'Kanpur', isActive: true },
    { id: 'city_imf', name: 'Imphal', isActive: true },
    { id: 'city_del', name: 'Delhi', isActive: true },
    { id: 'city_pat', name: 'Patna', isActive: false },
  ]
  const areaRows: [string, string, string][] = [
    ['area_faz', 'city_lko', 'Faizabad Road'],
    ['area_ali', 'city_lko', 'Aliganj'],
    ['area_ind', 'city_lko', 'Indira Nagar'],
    ['area_kri', 'city_lko', 'Krishna Nagar'],
    ['area_gom', 'city_lko', 'Gomti Nagar'],
    ['area_swa', 'city_knp', 'Swaroop Nagar'],
    ['area_kak', 'city_knp', 'Kakadeo'],
    ['area_sin', 'city_imf', 'Singjamei'],
    ['area_thg', 'city_imf', 'Thangmeiband'],
    ['area_mkj', 'city_del', 'Mukherjee Nagar'],
    ['area_ksr', 'city_del', 'Karol Bagh'],
  ]
  const areas: Area[] = areaRows.map(([id, cityId, name]) => ({ id, cityId, name, isActive: true }))

  const profiles: Profile[] = [
    { id: 'u_admin', name: 'Joel (Admin)', email: 'admin@studyseat.app', phone: '9000000001', role: 'admin' },
    { id: 'u_anil', name: 'Anil Verma', email: 'anil.verma@gmail.com', phone: '9415000011', role: 'owner' },
    { id: 'u_sunita', name: 'Sunita Rawat', email: 'sunita.rawat@gmail.com', phone: '9415000012', role: 'owner' },
    { id: 'u_manoj', name: 'Manoj Tripathi', email: 'manoj.t@gmail.com', phone: '9415000013', role: 'owner' },
    { id: 'u_farah', name: 'Farah Siddiqui', email: 'farah.s@gmail.com', phone: '9415000014', role: 'owner' },
    { id: 'u_deepak', name: 'Deepak Sahu', email: 'deepak.sahu@gmail.com', phone: '9415000015', role: 'owner' },
    { id: 'u_rekha', name: 'Rekha Gautam', email: 'rekha.g@gmail.com', phone: '9415000016', role: 'owner' },
    { id: 'u_ibomcha', name: 'Ibomcha Singh', email: 'ibomcha.s@gmail.com', phone: '9856000017', role: 'owner' },
    { id: 'u_riya', name: 'Riya Sharma', email: 'riya.sharma@gmail.com', phone: '9792000021', role: 'student' },
    { id: 'u_aman', name: 'Aman Gupta', email: 'aman.gupta@gmail.com', phone: '9792000022', role: 'student' },
    { id: 'u_sana', name: 'Sana Khan', email: 'sana.khan@gmail.com', phone: '9792000023', role: 'student' },
    { id: 'u_rahul', name: 'Rahul Yadav', email: 'rahul.yadav@gmail.com', phone: '9792000024', role: 'student' },
  ]

  type LibSeed = {
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
    status: Library['approvalStatus']
    reason?: string
  }

  const libs: LibSeed[] = [
    {
      id: 'lib_gyan', ownerId: 'u_anil', name: 'Gyan Deep Study Hub', cityId: 'city_lko', areaId: 'area_faz',
      address: '2nd Floor, Shanti Complex, Faizabad Road', pincode: '226016', landmark: 'Opposite Axis Bank',
      phone: '9415000011', capacity: 39, timings: '8:30 am to 9:00 pm',
      amenities: ['AC', 'Wi-Fi', 'Power socket', 'Water purifier', 'Silent zone', 'CCTV'], status: 'approved',
    },
    {
      id: 'lib_nalanda', ownerId: 'u_sunita', name: 'Nalanda Reading Room', cityId: 'city_lko', areaId: 'area_ali',
      address: '14, Sector J, Aliganj', pincode: '226024', landmark: 'Near Aliganj Hanuman Mandir',
      phone: '9415000012', capacity: 30, timings: '8:30 am to 9:00 pm',
      amenities: ['Wi-Fi', 'Power socket', 'Locker', 'Silent zone'], status: 'approved',
    },
    {
      id: 'lib_quiet', ownerId: 'u_manoj', name: 'Quiet Hours Library', cityId: 'city_lko', areaId: 'area_ind',
      address: 'B-27, Sector 12, Indira Nagar', pincode: '226016', landmark: 'Behind Munshipulia Chauraha',
      phone: '9415000013', capacity: 24, timings: 'Open 24 hours',
      amenities: ['AC', 'Wi-Fi', 'Power socket', 'Open 24 hours', 'Tea & coffee'], status: 'approved',
    },
    {
      id: 'lib_scholars', ownerId: 'u_farah', name: "Scholars' Den", cityId: 'city_lko', areaId: 'area_kri',
      address: '41, Krishna Nagar Main Road', pincode: '226023', landmark: 'Next to Sai Medical Store',
      phone: '9415000014', capacity: 20, timings: '8:30 am to 12:30 pm',
      amenities: ['Wi-Fi', 'Power socket', 'Parking'], status: 'approved',
    },
    {
      id: 'lib_lakshya', ownerId: 'u_deepak', name: 'Lakshya Self Study', cityId: 'city_lko', areaId: 'area_gom',
      address: 'Vibhuti Khand, Gomti Nagar', pincode: '226010', landmark: 'Near Patrakarpuram crossing',
      phone: '9415000015', capacity: 36, timings: '8:30 am to 9:00 pm',
      amenities: ['AC', 'Wi-Fi', 'Power socket', 'Locker', 'CCTV', 'Parking'], status: 'pending',
    },
    {
      id: 'lib_nest', ownerId: 'u_rekha', name: 'Study Nest', cityId: 'city_knp', areaId: 'area_swa',
      address: '88, Swaroop Nagar', pincode: '208002', landmark: 'Near Kanpur Medical Store',
      phone: '9415000016', capacity: 18, timings: '8:30 am to 12:30 pm',
      amenities: ['Wi-Fi', 'Power socket'], status: 'rejected',
      reason: 'The phone number did not connect and the address has no landmark we could find. Please check both, then resubmit.',
    },
    {
      id: 'lib_khwai', ownerId: 'u_ibomcha', name: 'Khwairakpam Study Centre', cityId: 'city_imf', areaId: 'area_sin',
      address: 'Singjamei Chingamakha, Near Uripok Road', pincode: '795008', landmark: 'Above Keishampat Stationers',
      phone: '9856000017', capacity: 28, timings: '8:30 am to 9:00 pm',
      amenities: ['Wi-Fi', 'Power socket', 'Water purifier', 'Silent zone', 'Tea & coffee'], status: 'approved',
    },
  ]

  const libraries: Library[] = libs.map((l) => ({
    id: l.id, ownerId: l.ownerId, name: l.name, cityId: l.cityId, areaId: l.areaId, address: l.address,
    pincode: l.pincode, landmark: l.landmark, phone: l.phone, capacity: l.capacity,
    timings: l.timings, amenities: l.amenities, photos: [],
    approvalStatus: l.status, rejectionReason: l.reason ?? null, createdAt: iso(-90),
  }))

  // ---- shifts: each library sets its own times and fees (no overlaps, up to three) ----
  const sh = (libraryId: string, n: number, name: string, startTime: string, endTime: string, rupees: number): Shift => ({
    id: `${libraryId}_sh${n}`, libraryId, name, startTime, endTime, monthlyFeePaise: rupees * 100, isActive: true,
  })
  const shifts: Shift[] = [
    sh('lib_gyan', 1, 'Morning', '08:30', '12:30', 1000),
    sh('lib_gyan', 2, 'Afternoon', '13:00', '17:00', 800),
    sh('lib_gyan', 3, 'Evening', '18:00', '21:00', 700),
    sh('lib_nalanda', 1, 'Morning', '08:30', '12:30', 800),
    sh('lib_nalanda', 2, 'Afternoon', '13:00', '17:00', 600),
    sh('lib_nalanda', 3, 'Evening', '18:00', '21:00', 500),
    sh('lib_quiet', 1, 'Day', '06:00', '18:00', 1200),
    sh('lib_quiet', 2, 'Night', '18:00', '06:00', 1000),
    sh('lib_scholars', 1, 'Morning', '08:30', '12:30', 900),
    sh('lib_lakshya', 1, 'Morning', '08:30', '12:30', 1500),
    sh('lib_lakshya', 2, 'Afternoon', '13:00', '17:00', 1200),
    sh('lib_lakshya', 3, 'Evening', '18:00', '21:00', 1000),
    sh('lib_nest', 1, 'Morning', '08:30', '12:30', 700),
    sh('lib_khwai', 1, 'Morning', '08:30', '12:30', 600),
    sh('lib_khwai', 2, 'Afternoon', '13:00', '17:00', 500),
    sh('lib_khwai', 3, 'Evening', '18:00', '21:00', 400),
  ]
  // Khwairakpam's Evening shift is switched off: hidden from new students, but its students stay tagged to it.
  shifts.find((s) => s.id === 'lib_khwai_sh3')!.isActive = false

  const subscriptions: Subscription[] = [
    { libraryId: 'lib_gyan', trialEndsAt: iso(9), activeUntil: iso(9) },
    { libraryId: 'lib_nalanda', trialEndsAt: iso(-56), activeUntil: iso(22) },
    { libraryId: 'lib_quiet', trialEndsAt: iso(1.5), activeUntil: iso(1.5) },
    { libraryId: 'lib_scholars', trialEndsAt: iso(-40), activeUntil: iso(-5) },
    { libraryId: 'lib_khwai', trialEndsAt: iso(-30), activeUntil: iso(27) },
  ]

  const planPayments: PlanPayment[] = [
    { id: 'pp_1', libraryId: 'lib_nalanda', amountPaise: 19900, utr: '412345678901', status: 'verified', failureReason: null, submittedAt: iso(-8.2), verifiedAt: iso(-8) },
    { id: 'pp_2', libraryId: 'lib_khwai', amountPaise: 19900, utr: '412398712345', status: 'verified', failureReason: null, submittedAt: iso(-3.1), verifiedAt: iso(-3) },
    { id: 'pp_3', libraryId: 'lib_quiet', amountPaise: 19900, utr: '412398760021', status: 'pending', failureReason: null, submittedAt: iso(-0.1), verifiedAt: null },
    { id: 'pp_4', libraryId: 'lib_scholars', amountPaise: 19900, utr: '412300001111', status: 'verified', failureReason: null, submittedAt: iso(-36), verifiedAt: iso(-35.5) },
    { id: 'pp_5', libraryId: 'lib_scholars', amountPaise: 19900, utr: '412300002222', status: 'failed', failureReason: 'UTR not found in the bank statement. Check the number and submit again.', submittedAt: iso(-6), verifiedAt: null },
  ]

  const seats: Seat[] = []
  const members: Member[] = []
  const feePayments: FeePayment[] = []
  let personIdx = 0

  type ShiftPlan = {
    shiftNo: number
    /** Days until expiry for each student (negative = overdue). */
    offsets: number[]
    /** Leave gaps between seats so some stay free. Off = seats filled one after another (a full shift). */
    spread?: boolean
    /** Index in `offsets` -> linked student account. */
    links?: Record<number, string>
  }

  function build(libId: string, seatCount: number, plans: ShiftPlan[], inactiveSeats: number[] = []) {
    for (let n = 1; n <= seatCount; n++) {
      seats.push({ id: `${libId}_s${n}`, libraryId: libId, seatNumber: n, isActive: !inactiveSeats.includes(n) })
    }
    const usable = seats.filter((s) => s.libraryId === libId && s.isActive)

    for (const plan of plans) {
      const shift = shifts.find((s) => s.id === `${libId}_sh${plan.shiftNo}`)!
      plan.offsets.forEach((off, i) => {
        // Each shift fills seats from the start, so one seat can hold different students in different shifts.
        const seat = usable[plan.spread ? i + Math.floor(i / 6) : i]
        const studentId = plan.links?.[i] ?? null
        const profile = studentId ? profiles.find((p) => p.id === studentId)! : null
        personIdx++
        const id = `${shift.id}_m${i + 1}`
        const expiry = date(off)
        members.push({
          id, libraryId: libId, studentId, shiftId: shift.id,
          name: profile ? profile.name : personName(personIdx),
          phone: profile ? profile.phone : phone(personIdx),
          seatId: seat?.id ?? null, startDate: addDays(expiry, -30), expiryDate: expiry, status: 'active', removedAt: null,
        })
        feePayments.push({ id: `${id}_f1`, memberId: id, libraryId: libId, amountPaise: shift.monthlyFeePaise, paidOn: addDays(expiry, -30), mode: i % 3 === 0 ? 'upi' : 'cash', isVoid: false, voidReason: null })
        if (i % 4 === 0) {
          feePayments.push({ id: `${id}_f0`, memberId: id, libraryId: libId, amountPaise: shift.monthlyFeePaise, paidOn: addDays(expiry, -60), mode: 'cash', isVoid: false, voidReason: null })
        }
      })
    }

    // One removed student with history, to show records are never hard-deleted.
    const first = shifts.find((s) => s.id === `${libId}_sh1`)!
    const rid = `${libId}_mr`
    personIdx++
    members.push({ id: rid, libraryId: libId, studentId: null, shiftId: first.id, name: personName(personIdx), phone: phone(personIdx + 99), seatId: null, startDate: date(-75), expiryDate: date(-45), status: 'removed', removedAt: iso(-44) })
    feePayments.push({ id: `${rid}_f1`, memberId: rid, libraryId: libId, amountPaise: first.monthlyFeePaise, paidOn: date(-75), mode: 'cash', isVoid: false, voidReason: null })
  }

  // Gyan Deep: the Morning shift is completely FULL (all 39 seats), Afternoon and Evening have plenty free.
  // Riya holds two memberships: Morning and Evening.
  build(
    'lib_gyan',
    40,
    [
      {
        shiftNo: 1,
        offsets: [-6, -2, 1, 2, 3, 4, 5, 6, 7, 9, 12, 15, 18, 20, 22, 25, 27, 28, 30, 30, 15, 12, 10, 26, 19, 24, 21, 17, 14, 11, 8, 13, 16, 23, 29, 18, 22, 26, 9],
        links: { 8: 'u_riya' },
      },
      { shiftNo: 2, offsets: [3, 9, 14, 20, 26, 5, -1, 17], spread: true },
      { shiftNo: 3, offsets: [4, 10, 15, 21, 27, 2, 8, 13, 19, 25, 29, 6], spread: true, links: { 3: 'u_riya' } },
    ],
    [13],
  )
  build('lib_nalanda', 30, [
    { shiftNo: 1, offsets: [-3, 2, 6, 11, 14, 18, 21, 24, 28, 30, 9, 16], spread: true },
    { shiftNo: 2, offsets: [4, 12, 19, 25, 8, 22], spread: true },
    { shiftNo: 3, offsets: [7, 17, 27], spread: true },
  ])
  build('lib_quiet', 24, [
    { shiftNo: 1, offsets: [1, 3, 8, 13, 17, 20, 25, 29, 22], spread: true },
    { shiftNo: 2, offsets: [5, 11, 18, 24, 28], spread: true },
  ])
  build('lib_scholars', 20, [{ shiftNo: 1, offsets: [-12, -9, -7, -5, -4, -3, -1, 0], spread: true }])
  build('lib_khwai', 28, [
    { shiftNo: 1, offsets: [2, 5, 10, 14, 19, 23, 26, 29, 12, 21], spread: true },
    { shiftNo: 2, offsets: [6, 15, 24, 9], spread: true },
    { shiftNo: 3, offsets: [3, 13, 20, 27, 16], spread: true },
  ])

  const sr = (id: string, studentId: string, libraryId: string, shiftNo: number, status: SeatRequest['status'], createdDays: number, decidedDays: number | null): SeatRequest => {
    const p = profiles.find((x) => x.id === studentId)!
    return {
      id, studentId, studentName: p.name, studentPhone: p.phone, libraryId, shiftId: `${libraryId}_sh${shiftNo}`,
      status, createdAt: iso(createdDays), decidedAt: decidedDays === null ? null : iso(decidedDays),
    }
  }
  const seatRequests: SeatRequest[] = [
    sr('sr_1', 'u_aman', 'lib_gyan', 2, 'pending', -1.2, null),
    sr('sr_2', 'u_sana', 'lib_gyan', 3, 'pending', -0.6, null),
    sr('sr_3', 'u_rahul', 'lib_gyan', 3, 'pending', -0.2, null),
    sr('sr_4', 'u_aman', 'lib_nalanda', 1, 'pending', -2, null),
    sr('sr_5', 'u_sana', 'lib_khwai', 1, 'cancelled', -5, -4.8),
    sr('sr_6', 'u_rahul', 'lib_quiet', 1, 'rejected', -9, -8),
  ]

  return {
    version: DB_VERSION,
    sessionUserId: null,
    cities,
    areas,
    profiles,
    libraries,
    shifts,
    subscriptions,
    planPayments,
    seats,
    members,
    feePayments,
    seatRequests,
  }
}
