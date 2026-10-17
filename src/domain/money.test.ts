import { describe, expect, it } from 'vitest'
import { formatRupees } from '@/domain/money'

describe('formatRupees', () => {
  it('formats paise as rupees with Indian digit grouping', () => {
    expect(formatRupees(19900)).toBe('₹199')
    expect(formatRupees(125000000)).toBe('₹12,50,000')
  })

  it('shows paise only when there are any', () => {
    expect(formatRupees(19950)).toBe('₹199.50')
  })

  it('handles zero', () => {
    expect(formatRupees(0)).toBe('₹0')
  })

  it('rejects non-integer paise', () => {
    expect(() => formatRupees(10.5)).toThrow()
  })
})
