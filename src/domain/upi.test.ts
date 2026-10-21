import { describe, expect, it } from 'vitest'
import { buildUpiLink } from '@/domain/upi'

const base = { upiId: 'owner.name@oksbi', payeeName: 'NearMe Library', amountPaise: 19900, note: 'NearMe Library plan' }
const params = (link: string) => new URL(link.replace('upi://', 'https://upi.invalid/')).searchParams

describe('buildUpiLink (the link behind the Pay button AND the QR code)', () => {
  it('uses the NPCI form upi://pay with the payee, name, amount, currency and note', () => {
    const link = buildUpiLink(base)
    expect(link.startsWith('upi://pay?')).toBe(true)
    const p = params(link)
    expect(p.get('pa')).toBe('owner.name@oksbi')
    expect(p.get('pn')).toBe('NearMe Library')
    expect(p.get('am')).toBe('199.00')
    expect(p.get('cu')).toBe('INR')
    expect(p.get('tn')).toBe('NearMe Library plan')
  })

  it('always has a real payment note, never an empty or blank one (the rename once left only " plan")', () => {
    const note = params(buildUpiLink(base)).get('tn') ?? ''
    expect(note.trim().length).toBeGreaterThan(4)
    expect(note).not.toMatch(/^\s/)
  })

  it('percent-encodes spaces as %20 (the UPI spec) and never as +', () => {
    const link = buildUpiLink(base)
    expect(link).toContain('pn=NearMe%20Library')
    expect(link).not.toContain('+')
  })

  it('writes the amount with exactly two decimals', () => {
    expect(params(buildUpiLink({ ...base, amountPaise: 19900 })).get('am')).toBe('199.00')
    expect(params(buildUpiLink({ ...base, amountPaise: 150 })).get('am')).toBe('1.50')
  })

  it('a name or note with & # ? = quotes or brackets cannot add or end a parameter', () => {
    const link = buildUpiLink({ ...base, payeeName: "Smith & Sons (Pvt) Ltd's #1", note: 'plan?x=1&am=1' })
    const p = params(link)
    expect(p.get('pn')).toBe("Smith & Sons (Pvt) Ltd's #1")
    expect(p.get('tn')).toBe('plan?x=1&am=1')
    expect(p.get('am')).toBe('199.00')
    expect(link).not.toMatch(/[()'!*]/)
  })

  it('refuses an amount that is not a positive whole number of paise', () => {
    for (const bad of [0, -5, 1.5, NaN, Infinity]) expect(() => buildUpiLink({ ...base, amountPaise: bad })).toThrow()
  })
})