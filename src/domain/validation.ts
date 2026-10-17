import { isValidPhone, isValidPincode } from '@/domain/constants'
import type { LibraryInput } from '@/domain/types'

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>

/** Friendly, field-level messages for the library form. The database re-checks everything. */
export function validateLibraryInput(i: LibraryInput): FieldErrors<keyof LibraryInput> {
  const e: FieldErrors<keyof LibraryInput> = {}
  if (!i.name.trim()) e.name = 'Enter your library’s name.'
  if (!i.cityId) e.cityId = 'Choose a city.'
  if (!i.areaId) e.areaId = 'Choose an area.'
  if (!i.address.trim()) e.address = 'Enter the street address.'
  if (!isValidPincode(i.pincode)) e.pincode = 'Enter a 6-digit pincode.'
  if (!isValidPhone(i.phone)) e.phone = 'Enter a 10-digit mobile number.'
  if (!Number.isInteger(i.capacity) || i.capacity < 1 || i.capacity > 500) {
    e.capacity = 'Enter between 1 and 500 seats.'
  }
  if (!Number.isInteger(i.monthlyFeePaise) || i.monthlyFeePaise <= 0) {
    e.monthlyFeePaise = 'Enter the monthly fee in rupees.'
  }
  if (!i.timings.trim()) e.timings = 'Enter your opening hours.'
  return e
}

export function validateMemberFields(name: string, phone: string): FieldErrors<'name' | 'phone'> {
  const e: FieldErrors<'name' | 'phone'> = {}
  if (!name.trim()) e.name = 'Enter the student’s name.'
  if (!isValidPhone(phone)) e.phone = 'Enter a 10-digit mobile number.'
  return e
}

export const hasErrors = (e: object) => Object.keys(e).length > 0

/** Rupees typed in a form (e.g. "1,000" or "1000.50") -> integer paise, or null if invalid. */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 100)
}
