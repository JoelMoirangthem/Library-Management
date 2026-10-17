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
  Subscription,
} from '@/domain/types'

export type DB = {
  version: number
  sessionUserId: string | null
  cities: City[]
  areas: Area[]
  profiles: Profile[]
  libraries: Library[]
  subscriptions: Subscription[]
  planPayments: PlanPayment[]
  seats: Seat[]
  members: Member[]
  feePayments: FeePayment[]
  seatRequests: SeatRequest[]
}

export const DB_VERSION = 1

const DAY = 86_400_000
const NAMES = [
  'Aarav Mishra', 'Ishita Verma', 'Kabir Singh', 'Meera Pandey', 'Rohan Tiwari', 'Ananya Dubey',
  'Vivek Yadav', 'Priya Nair', 'Arjun Chauhan', 'Neha Kapoor', 'Siddharth Rao', 'Pooja Saxena',
  'Harsh Vardhan', 'Kavya Joshi', 'Nikhil Agarwal', 'Shreya Bansal', 'Yash Rathore', 'Tanvi Mehra',
  'Devansh Gupta', 'Muskan Ansari', 'Karan Malhotra', 'Divya Shukla', 'Ayush Pathak', 'Simran Kaur',
  'Pranav Desai', 'Ritika Sinha', 'Mohit Bhatt', 'Jaya Mukherjee', 'Abhay Thakur', 'Nandini Iyer',
  'Sahil Khan', 'Bhavna Rawat', 'Tushar Jain', 'Komal Chaudhary', 'Utkarsh Dwivedi', 'Palak Sharma',
]

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
    fee: number
    timings: string
    amenities: string[]
    status: Library['approvalStatus']
    reason?: string
  }

  const libs: LibSeed[] = [
    {
      id: 'lib_gyan', ownerId: 'u_anil', name: 'Gyan Deep Study Hub', cityId: 'city_lko', areaId: 'area_faz',
      address: '2nd Floor, Shanti Complex, Faizabad Road', pincode: '226016', landmark: 'Opposite Axis Bank',
      phone: '9415000011', capacity: 39, fee: 1000, timings: '6:00 am to 11:00 pm',
      amenities: ['AC', 'Wi-Fi', 'Power socket', 'Water purifier', 'Silent zone', 'CCTV'], status: 'approved',
    },
    {
      id: 'lib_nalanda', ownerId: 'u_sunita', name: 'Nalanda Reading Room', cityId: 'city_lko', areaId: 'area_ali',
      address: '14, Sector J, Aliganj', pincode: '226024', landmark: 'Near Aliganj Hanuman Mandir',
      phone: '9415000012', capacity: 30, fee: 800, timings: '7:00 am to 10:00 pm',
      amenities: ['Wi-Fi', 'Power socket', 'Locker', 'Silent zone'], status: 'approved',
    },
    {
      id: 'lib_quiet', ownerId: 'u_manoj', name: 'Quiet Hours Library', cityId: 'city_lko', areaId: 'area_ind',
      address: 'B-27, Sector 12, Indira Nagar', pincode: '226016', landmark: 'Behind Munshipulia Chauraha',
      phone: '9415000013', capacity: 24, fee: 1200, timings: 'Open 24 hours',
      amenities: ['AC', 'Wi-Fi', 'Power socket', 'Open 24 hours', 'Tea & coffee'], status: 'approved',
    },
    {
      id: 'lib_scholars', ownerId: 'u_farah', name: "Scholars' Den", cityId: 'city_lko', areaId: 'area_kri',
      address: '41, Krishna Nagar Main Road', pincode: '226023', landmark: 'Next to Sai Medical Store',
      phone: '9415000014', capacity: 20, fee: 900, timings: '6:30 am to 9:30 pm',
      amenities: ['Wi-Fi', 'Power socket', 'Parking'], status: 'approved',
    },
    {
      id: 'lib_lakshya', ownerId: 'u_deepak', name: 'Lakshya Self Study', cityId: 'city_lko', areaId: 'area_gom',
      address: 'Vibhuti Khand, Gomti Nagar', pincode: '226010', landmark: 'Near Patrakarpuram crossing',
      phone: '9415000015', capacity: 36, fee: 1500, timings: '6:00 am to 12:00 am',
      amenities: ['AC', 'Wi-Fi', 'Power socket', 'Locker', 'CCTV', 'Parking'], status: 'pending',
    },
    {
      id: 'lib_nest', ownerId: 'u_rekha', name: 'Study Nest', cityId: 'city_knp', areaId: 'area_swa',
      address: '88, Swaroop Nagar', pincode: '208002', landmark: 'Near Kanpur Medical Store',
      phone: '9415000016', capacity: 18, fee: 700, timings: '8:00 am to 8:00 pm',
      amenities: ['Wi-Fi', 'Power socket'], status: 'rejected',
      reason: 'The phone number did not connect and the address has no landmark we could find. Please check both, then resubmit.',
    },
    {
      id: 'lib_khwai', ownerId: 'u_ibomcha', name: 'Khwairakpam Study Centre', cityId: 'city_imf', areaId: 'area_sin',
      address: 'Singjamei Chingamakha, Near Uripok Road', pincode: '795008', landmark: 'Above Keishampat Stationers',
      phone: '9856000017', capacity: 28, fee: 600, timings: '6:00 am to 9:00 pm',
      amenities: ['Wi-Fi', 'Power socket', 'Water purifier', 'Silent zone', 'Tea & coffee'], status: 'approved',
    },
  ]

  const libraries: Library[] = libs.map((l) => ({
    id: l.id, ownerId: l.ownerId, name: l.name, cityId: l.cityId, areaId: l.areaId, address: l.address,
    pincode: l.pincode, landmark: l.landmark, phone: l.phone, capacity: l.capacity,
    monthlyFeePaise: l.fee * 100, timings: l.timings, amenities: l.amenities, photos: [],
    approvalStatus: l.status, rejectionReason: l.reason ?? null, createdAt: iso(-90),
  }))

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

  let nameIdx = 0
  const nextName = () => NAMES[nameIdx++ % NAMES.length]

  function build(libId: string, seatCount: number, expiryOffsets: number[], opts: { inactiveSeats?: number[]; studentLinks?: Record<number, string> } = {}) {
    const lib = libraries.find((l) => l.id === libId)!
    for (let n = 1; n <= seatCount; n++) {
      seats.push({ id: `${libId}_s${n}`, libraryId: libId, seatNumber: n, isActive: !opts.inactiveSeats?.includes(n) })
    }
    const usable = seats.filter((s) => s.libraryId === libId && s.isActive)
    expiryOffsets.forEach((off, i) => {
      // Spread members across seats, leaving gaps so some stay free.
      const seat = usable[i + Math.floor(i / 6)]
      const studentId = opts.studentLinks?.[i] ?? null
      const name = studentId ? profiles.find((p) => p.id === studentId)!.name : nextName()
      const id = `${libId}_m${i + 1}`
      const expiry = date(off)
      members.push({
        id, libraryId: libId, studentId, name, phone: studentId ? profiles.find((p) => p.id === studentId)!.phone : phone(nameIdx + i),
        seatId: seat?.id ?? null, startDate: addDays(expiry, -30), expiryDate: expiry, status: 'active', removedAt: null,
      })
      feePayments.push({ id: `${id}_f1`, memberId: id, libraryId: libId, amountPaise: lib.monthlyFeePaise, paidOn: addDays(expiry, -30), mode: i % 3 === 0 ? 'upi' : 'cash', isVoid: false, voidReason: null })
      if (i % 4 === 0) {
        feePayments.push({ id: `${id}_f0`, memberId: id, libraryId: libId, amountPaise: lib.monthlyFeePaise, paidOn: addDays(expiry, -60), mode: 'cash', isVoid: false, voidReason: null })
      }
    })
    // One removed member with history, to show "never hard-deleted".
    const rid = `${libId}_mr`
    members.push({ id: rid, libraryId: libId, studentId: null, name: nextName(), phone: phone(nameIdx + 99), seatId: null, startDate: date(-75), expiryDate: date(-45), status: 'removed', removedAt: iso(-44) })
    feePayments.push({ id: `${rid}_f1`, memberId: rid, libraryId: libId, amountPaise: lib.monthlyFeePaise, paidOn: date(-75), mode: 'cash', isVoid: false, voidReason: null })
  }

  build('lib_gyan', 40, [-6, -2, 1, 2, 3, 4, 5, 6, 7, 9, 12, 15, 18, 20, 22, 25, 27, 28, 30, 30, 15, 12, 10, 26, 19], {
    inactiveSeats: [13],
    studentLinks: { 8: 'u_riya' },
  })
  build('lib_nalanda', 30, [-3, 2, 6, 11, 14, 18, 21, 24, 28, 30, 9, 16])
  build('lib_quiet', 24, [1, 3, 8, 13, 17, 20, 25, 29, 22])
  build('lib_scholars', 20, [-12, -9, -7, -5, -4, -3, -1, 0])
  build('lib_khwai', 28, [2, 5, 10, 14, 19, 23, 26, 29, 12, 21])

  // Make Riya's membership one the student view can show (id fixed for readability).
  const seatRequests: SeatRequest[] = [
    { id: 'sr_1', studentId: 'u_aman', studentName: 'Aman Gupta', studentPhone: '9792000022', libraryId: 'lib_gyan', status: 'pending', createdAt: iso(-1.2), decidedAt: null },
    { id: 'sr_2', studentId: 'u_sana', studentName: 'Sana Khan', studentPhone: '9792000023', libraryId: 'lib_gyan', status: 'pending', createdAt: iso(-0.6), decidedAt: null },
    { id: 'sr_3', studentId: 'u_rahul', studentName: 'Rahul Yadav', studentPhone: '9792000024', libraryId: 'lib_gyan', status: 'pending', createdAt: iso(-0.2), decidedAt: null },
    { id: 'sr_4', studentId: 'u_aman', studentName: 'Aman Gupta', studentPhone: '9792000022', libraryId: 'lib_nalanda', status: 'pending', createdAt: iso(-2), decidedAt: null },
    { id: 'sr_5', studentId: 'u_sana', studentName: 'Sana Khan', studentPhone: '9792000023', libraryId: 'lib_khwai', status: 'cancelled', createdAt: iso(-5), decidedAt: iso(-4.8) },
    { id: 'sr_6', studentId: 'u_rahul', studentName: 'Rahul Yadav', studentPhone: '9792000024', libraryId: 'lib_quiet', status: 'rejected', createdAt: iso(-9), decidedAt: iso(-8) },
  ]

  return {
    version: DB_VERSION,
    sessionUserId: null,
    cities,
    areas,
    profiles,
    libraries,
    subscriptions,
    planPayments,
    seats,
    members,
    feePayments,
    seatRequests,
  }
}
