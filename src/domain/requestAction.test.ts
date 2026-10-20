import { describe, expect, it } from 'vitest'
import { requestActionKind } from '@/domain/requestAction'

describe('requestActionKind (what a library page offers, depending on who is looking)', () => {
  it('asks a signed-out visitor to log in', () => {
    expect(requestActionKind(null)).toBe('sign-in')
  })

  it('sends a signed-in person who has not chosen a role yet to the role chooser, not to a dead end', () => {
    expect(requestActionKind({ role: null })).toBe('choose-role')
  })

  it('tells owners and admins that only students request seats', () => {
    expect(requestActionKind({ role: 'owner' })).toBe('students-only')
    expect(requestActionKind({ role: 'admin' })).toBe('students-only')
  })

  it('lets a student request', () => {
    expect(requestActionKind({ role: 'student' })).toBe('student')
  })
})