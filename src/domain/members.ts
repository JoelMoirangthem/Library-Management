import { addDays } from '@/domain/dates'
import type { Member } from '@/domain/types'

export const EXPIRING_WITHIN_DAYS = 7

/** BR-11: derived from the expiry date, never stored. */
export type MemberPhase = 'active' | 'expiring' | 'expired'

export function memberDaysLeft(member: Pick<Member, 'expiryDate'>, today: string): number {
  const [y1, m1, d1] = today.split('-').map(Number)
  const [y2, m2, d2] = member.expiryDate.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

export function memberPhase(member: Pick<Member, 'expiryDate'>, today: string): MemberPhase {
  const left = memberDaysLeft(member, today)
  if (left < 0) return 'expired'
  if (left <= EXPIRING_WITHIN_DAYS) return 'expiring'
  return 'active'
}

/** Default new expiry for a renewal: 30 days after the later of today and the current expiry. */
export function renewalExpiry(member: Pick<Member, 'expiryDate'>, today: string, days = 30): string {
  const base = member.expiryDate > today ? member.expiryDate : today
  return addDays(base, days)
}
