import { describe, expect, it } from 'vitest'
import {
  canEditProfile,
  canOwnerWrite,
  extendedActiveUntil,
  newTrial,
  planState,
} from '@/domain/plan'
import type { Subscription } from '@/domain/types'

const now = new Date('2026-10-17T10:00:00Z')
const day = 86_400_000
const at = (days: number) => new Date(now.getTime() + days * day).toISOString()
const sub = (trialDays: number, activeDays: number): Subscription => ({
  libraryId: 'l',
  trialEndsAt: at(trialDays),
  activeUntil: at(activeDays),
})

describe('planState', () => {
  it('pending and rejected libraries are never active', () => {
    expect(planState({ approvalStatus: 'pending' }, null, now)).toBe('pending')
    expect(planState({ approvalStatus: 'rejected' }, null, now)).toBe('rejected')
  })

  it('is trial until the plan is extended past the trial end', () => {
    expect(planState({ approvalStatus: 'approved' }, sub(9, 9), now)).toBe('trial')
  })

  it('is paid when active_until is beyond the trial end', () => {
    expect(planState({ approvalStatus: 'approved' }, sub(-20, 10), now)).toBe('paid')
  })

  it('is expired once active_until has passed', () => {
    expect(planState({ approvalStatus: 'approved' }, sub(-30, -1), now)).toBe('expired')
  })
})

describe('write rules (BR-6)', () => {
  it('expired owners cannot write or edit the profile', () => {
    expect(canOwnerWrite('expired')).toBe(false)
    expect(canEditProfile('expired')).toBe(false)
  })
  it('pending and rejected owners can edit the profile but not run the library', () => {
    expect(canEditProfile('pending')).toBe(true)
    expect(canEditProfile('rejected')).toBe(true)
    expect(canOwnerWrite('pending')).toBe(false)
  })
  it('trial and paid owners can do everything', () => {
    expect(canOwnerWrite('trial')).toBe(true)
    expect(canOwnerWrite('paid')).toBe(true)
  })
})

describe('plan stacking (BR-4)', () => {
  it('keeps unused trial days when paying early', () => {
    const next = extendedActiveUntil(sub(9, 9), now)
    expect((next.getTime() - now.getTime()) / day).toBeCloseTo(39)
  })

  it('stacks early renewals on the remaining days', () => {
    const next = extendedActiveUntil(sub(-20, 22), now)
    expect((next.getTime() - now.getTime()) / day).toBeCloseTo(52)
  })

  it('starts from now when the plan already expired', () => {
    const next = extendedActiveUntil(sub(-30, -5), now)
    expect((next.getTime() - now.getTime()) / day).toBeCloseTo(30)
  })

  it('treats a missing subscription as expired', () => {
    expect((extendedActiveUntil(null, now).getTime() - now.getTime()) / day).toBeCloseTo(30)
  })
})

describe('newTrial (BR-3)', () => {
  it('lasts 14 days from approval and trial end equals active_until', () => {
    const t = newTrial('l', now)
    expect(t.trialEndsAt).toBe(t.activeUntil)
    expect((new Date(t.activeUntil).getTime() - now.getTime()) / day).toBe(14)
  })
})
