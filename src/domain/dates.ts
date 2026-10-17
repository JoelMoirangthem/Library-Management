const IST = 'Asia/Kolkata'
const DAY_MS = 86_400_000

/** Today's calendar date in India as `YYYY-MM-DD`. `now` is always passed in so tests and the fake clock work. */
export function todayIST(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`). Negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)
}

/** Whole days left until an ISO timestamp, rounded up. 0 or negative means it has passed. */
export function daysUntil(until: string | Date, now: Date): number {
  return Math.ceil((new Date(until).getTime() - now.getTime()) / DAY_MS)
}

export function addDaysToDate(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

/** `2026-11-24` -> `24 Nov 2026`. */
export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`))
}

/** ISO timestamp -> `24 Nov 2026, 3:05 pm` in IST. */
export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

/** ISO timestamp -> the IST calendar date it falls on. */
export function dateOfInstant(iso: string): string {
  return todayIST(new Date(iso))
}
