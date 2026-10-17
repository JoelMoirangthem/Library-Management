import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHIFTS,
  formatShiftRange,
  formatTime,
  shiftsOverlap,
  validateShiftSet,
} from '@/domain/shifts'

const s = (name: string, startTime: string, endTime: string, fee = 80000) => ({
  name,
  startTime,
  endTime,
  monthlyFeePaise: fee,
})

describe('shift times', () => {
  it('formats 24h times for people', () => {
    expect(formatTime('08:30')).toBe('8:30 am')
    expect(formatTime('13:00')).toBe('1:00 pm')
    expect(formatTime('00:00')).toBe('12:00 am')
    expect(formatTime('12:15')).toBe('12:15 pm')
    expect(formatShiftRange({ startTime: '18:00', endTime: '21:00' })).toBe('6:00 pm to 9:00 pm')
  })
})

describe('shiftsOverlap', () => {
  it('default shifts do not overlap', () => {
    for (let i = 0; i < DEFAULT_SHIFTS.length; i++)
      for (let j = i + 1; j < DEFAULT_SHIFTS.length; j++)
        expect(shiftsOverlap(DEFAULT_SHIFTS[i], DEFAULT_SHIFTS[j])).toBe(false)
  })
  it('touching ends are fine', () => {
    expect(shiftsOverlap(s('A', '08:00', '12:00'), s('B', '12:00', '16:00'))).toBe(false)
  })
  it('detects shared time', () => {
    expect(shiftsOverlap(s('A', '08:00', '12:00'), s('B', '11:59', '16:00'))).toBe(true)
  })
  it('handles a night shift that crosses midnight', () => {
    const night = s('Night', '22:00', '06:00')
    expect(shiftsOverlap(night, s('Early', '05:00', '08:00'))).toBe(true)
    expect(shiftsOverlap(night, s('Day', '06:00', '22:00'))).toBe(false)
    expect(shiftsOverlap(night, s('Late', '23:00', '23:30'))).toBe(true)
  })
})

describe('validateShiftSet', () => {
  it('accepts the three defaults with fees', () => {
    const set = DEFAULT_SHIFTS.map((d) => ({ ...d, monthlyFeePaise: 80000 }))
    expect(validateShiftSet(set)).toBeNull()
  })
  it('needs between one and three', () => {
    expect(validateShiftSet([])).toMatch(/at least one/i)
    const four = [s('A', '01:00', '02:00'), s('B', '03:00', '04:00'), s('C', '05:00', '06:00'), s('D', '07:00', '08:00')]
    expect(validateShiftSet(four)).toMatch(/up to 3/i)
  })
  it('names the shifts that overlap', () => {
    expect(validateShiftSet([s('Morning', '08:00', '12:00'), s('Noon', '11:00', '14:00')])).toMatch(/Morning and Noon overlap/)
  })
  it('rejects duplicate names, bad times and zero fees', () => {
    expect(validateShiftSet([s('Morning', '08:00', '09:00'), s('morning', '10:00', '11:00')])).toMatch(/named/)
    expect(validateShiftSet([s('A', '09:00', '09:00')])).toMatch(/different/)
    expect(validateShiftSet([s('A', '09:00', '10:00', 0)])).toMatch(/fee/)
  })
})

