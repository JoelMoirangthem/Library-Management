import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, daysUntil, formatDate, todayIST } from '@/domain/dates'

describe('dates', () => {
  it('todayIST uses the Indian calendar day, not UTC', () => {
    // 20:00 UTC on 16 Oct is 01:30 IST on 17 Oct.
    expect(todayIST(new Date('2026-10-16T20:00:00Z'))).toBe('2026-10-17')
    expect(todayIST(new Date('2026-10-16T10:00:00Z'))).toBe('2026-10-16')
  })

  it('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('daysBetween is signed', () => {
    expect(daysBetween('2026-10-17', '2026-10-24')).toBe(7)
    expect(daysBetween('2026-10-17', '2026-10-15')).toBe(-2)
  })

  it('daysUntil rounds up partial days', () => {
    const now = new Date('2026-10-17T00:00:00Z')
    expect(daysUntil('2026-10-18T00:00:01Z', now)).toBe(2)
    expect(daysUntil('2026-10-17T00:00:00Z', now)).toBe(0)
  })

  it('formatDate is readable', () => {
    expect(formatDate('2026-11-24')).toBe('24 Nov 2026')
  })
})
