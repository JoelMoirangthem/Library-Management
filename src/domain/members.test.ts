import { describe, expect, it } from 'vitest'
import { memberDaysLeft, memberPhase, renewalExpiry } from '@/domain/members'

describe('memberPhase (BR-11)', () => {
  const today = '2026-10-17'
  it('expired when the expiry date is before today', () => {
    expect(memberPhase({ expiryDate: '2026-10-16' }, today)).toBe('expired')
  })
  it('expiring from today through 7 days out', () => {
    expect(memberPhase({ expiryDate: '2026-10-17' }, today)).toBe('expiring')
    expect(memberPhase({ expiryDate: '2026-10-24' }, today)).toBe('expiring')
  })
  it('active beyond 7 days', () => {
    expect(memberPhase({ expiryDate: '2026-10-25' }, today)).toBe('active')
  })
  it('counts days left', () => {
    expect(memberDaysLeft({ expiryDate: '2026-10-20' }, today)).toBe(3)
  })
})

describe('renewalExpiry', () => {
  it('stacks on the remaining days when not yet expired', () => {
    expect(renewalExpiry({ expiryDate: '2026-10-27' }, '2026-10-17')).toBe('2026-11-26')
  })
  it('starts from today when already expired', () => {
    expect(renewalExpiry({ expiryDate: '2026-10-01' }, '2026-10-17')).toBe('2026-11-16')
  })
})
