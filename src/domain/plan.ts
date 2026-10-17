import { addDaysToDate, daysUntil } from '@/domain/dates'
import type { Library, Subscription } from '@/domain/types'

export const TRIAL_DAYS = 14
export const PLAN_DAYS = 30
export const PLAN_PRICE_PAISE = 19900
/** Shown on the Plan page. Dummy value in mock mode. */
export const ADMIN_UPI_ID = 'studyseat@upi'

export type PlanState = 'pending' | 'rejected' | 'trial' | 'paid' | 'expired'

/**
 * Where a library stands. `trial` means the plan has never been extended past the trial.
 * Mirrors the SQL `is_library_active`: active = approved and now < active_until.
 */
export function planState(
  library: Pick<Library, 'approvalStatus'>,
  sub: Subscription | null,
  now: Date,
): PlanState {
  if (library.approvalStatus === 'pending') return 'pending'
  if (library.approvalStatus === 'rejected') return 'rejected'
  if (!sub) return 'expired'
  const until = new Date(sub.activeUntil)
  if (now >= until) return 'expired'
  return until <= new Date(sub.trialEndsAt) ? 'trial' : 'paid'
}

export function isActive(state: PlanState): boolean {
  return state === 'trial' || state === 'paid'
}

/** BR-6: every owner write except submitting a plan payment needs an active plan. */
export function canOwnerWrite(state: PlanState): boolean {
  return isActive(state)
}

/** BR-6: the profile may be edited while pending, rejected or active, not once expired. */
export function canEditProfile(state: PlanState): boolean {
  return state !== 'expired'
}

/** BR-4: a verified payment adds 30 days on top of whichever is later, now or the current end. */
export function extendedActiveUntil(sub: Subscription | null, now: Date, days = PLAN_DAYS): Date {
  const base = sub && new Date(sub.activeUntil) > now ? new Date(sub.activeUntil) : now
  return addDaysToDate(base, days)
}

/** BR-3: the trial starts at first approval and lasts 14 days. */
export function newTrial(libraryId: string, approvedAt: Date): Subscription {
  const end = addDaysToDate(approvedAt, TRIAL_DAYS).toISOString()
  return { libraryId, trialEndsAt: end, activeUntil: end }
}

export function planDaysLeft(sub: Subscription | null, now: Date): number {
  return sub ? Math.max(0, daysUntil(sub.activeUntil, now)) : 0
}
