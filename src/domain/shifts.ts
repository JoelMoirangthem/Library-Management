import type { Shift, ShiftInput } from '@/domain/types'

/** An owner can run up to three active shifts. */
export const MAX_ACTIVE_SHIFTS = 3

/** Pre-filled for every new library; the owner edits times and sets each fee. */
export const DEFAULT_SHIFTS: { name: string; startTime: string; endTime: string }[] = [
  { name: 'Morning', startTime: '08:30', endTime: '12:30' },
  { name: 'Afternoon', startTime: '13:00', endTime: '17:00' },
  { name: 'Evening', startTime: '18:00', endTime: '21:00' },
]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export const isValidTime = (v: string) => TIME.test(v)

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** `08:30` -> `8:30 am`, `13:00` -> `1:00 pm`. */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour = h % 12 === 0 ? 12 : h % 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

export function formatShiftRange(s: Pick<Shift, 'startTime' | 'endTime'>): string {
  return `${formatTime(s.startTime)} to ${formatTime(s.endTime)}`
}

/** `Morning, 8:30 am to 12:30 pm`. */
export function describeShift(s: Pick<Shift, 'name' | 'startTime' | 'endTime'>): string {
  return `${s.name}, ${formatShiftRange(s)}`
}

type Range = Pick<Shift, 'startTime' | 'endTime'>

/** Intervals as [start, end) in minutes; an end at or before the start means it runs past midnight. */
function span(r: Range): [number, number] {
  const start = toMinutes(r.startTime)
  let end = toMinutes(r.endTime)
  if (end <= start) end += 1440
  return [start, end]
}

/** True if two shifts share any time. Touching ends (12:30 and 12:30) do not overlap. Handles midnight. */
export function shiftsOverlap(a: Range, b: Range): boolean {
  const [as, ae] = span(a)
  const [bs, be] = span(b)
  return [-1440, 0, 1440].some((k) => as < be + k && bs + k < ae)
}

/** Friendly message for the first problem with a single shift, or null. */
export function validateShiftFields(s: ShiftInput): string | null {
  if (!s.name.trim()) return 'Give the shift a name, like Morning.'
  if (!isValidTime(s.startTime) || !isValidTime(s.endTime)) return 'Choose a start and end time.'
  if (s.startTime === s.endTime) return 'Start and end time must be different.'
  if (!Number.isInteger(s.monthlyFeePaise) || s.monthlyFeePaise <= 0) return 'Enter a monthly fee above zero.'
  return null
}

/**
 * Checks a full set of ACTIVE shifts: 1 to 3 of them, each valid, unique names, no overlaps.
 * Returns the first problem as a sentence, or null when fine.
 */
export function validateShiftSet(shifts: ShiftInput[]): string | null {
  if (shifts.length < 1) return 'Keep at least one shift.'
  if (shifts.length > MAX_ACTIVE_SHIFTS) return `You can run up to ${MAX_ACTIVE_SHIFTS} shifts.`
  for (const s of shifts) {
    const problem = validateShiftFields(s)
    if (problem) return problem
  }
  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      if (shifts[i].name.trim().toLowerCase() === shifts[j].name.trim().toLowerCase()) {
        return `Two shifts are named ${shifts[i].name.trim()}. Give each its own name.`
      }
      if (shiftsOverlap(shifts[i], shifts[j])) {
        return `${shifts[i].name.trim()} and ${shifts[j].name.trim()} overlap. Shifts can't share time.`
      }
    }
  }
  return null
}

/** Active shifts first, in clock order, so Morning comes before Evening. */
export function sortShifts<T extends Shift>(shifts: T[]): T[] {
  return [...shifts].sort(
    (a, b) => Number(b.isActive) - Number(a.isActive) || toMinutes(a.startTime) - toMinutes(b.startTime),
  )
}

/** `3 shifts`, `1 shift`, `No shifts` — compact count for dense list rows. */
export function formatShiftCount(count: number): string {
  if (count === 0) return 'No shifts'
  return count === 1 ? '1 shift' : `${count} shifts`
}
