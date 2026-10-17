import { describe, expect, it } from 'vitest'
import { formatPhone, isValidPhone, normalizePhone, whatsappLink } from '@/domain/constants'

describe('phone numbers', () => {
  it('cleans pasted numbers', () => {
    expect(normalizePhone('+91 98765 43210')).toBe('9876543210')
    expect(normalizePhone('098765-43210')).toBe('9876543210')
    expect(normalizePhone('(98765) 43210')).toBe('9876543210')
  })
  it('accepts Indian mobiles only', () => {
    expect(isValidPhone('+91 98765 43210')).toBe(true)
    expect(isValidPhone('12345 67890')).toBe(false)
    expect(isValidPhone('98765')).toBe(false)
  })
  it('formats for display and builds a WhatsApp link', () => {
    expect(formatPhone('9876543210')).toBe('98765 43210')
    expect(whatsappLink('98765 43210', 'Hi Ravi: your seat ends soon')).toBe(
      'https://wa.me/919876543210?text=Hi%20Ravi%3A%20your%20seat%20ends%20soon',
    )
  })
})
