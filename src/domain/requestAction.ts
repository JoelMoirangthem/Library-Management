import type { Role } from '@/domain/types'

/** What the "request a seat" area of a library page should offer. */
export type RequestActionKind = 'sign-in' | 'choose-role' | 'students-only' | 'student'

/**
 * Decided by who is looking: a signed-out visitor logs in; someone signed in who has not picked Student or Owner
 * yet is sent to the role chooser (they would otherwise hit a dead end); owners and admins are told only students
 * request seats; students get the real request controls.
 */
export function requestActionKind(user: { role: Role | null } | null): RequestActionKind {
  if (!user) return 'sign-in'
  if (user.role === null) return 'choose-role'
  if (user.role !== 'student') return 'students-only'
  return 'student'
}