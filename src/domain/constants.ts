export const AMENITIES = [
  'AC',
  'Wi-Fi',
  'Power socket',
  'Locker',
  'Water purifier',
  'Silent zone',
  'CCTV',
  'Tea & coffee',
  'Parking',
  'Open 24 hours',
] as const

export const FEE_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'other', label: 'Other' },
] as const

/** Indian mobile number: 10 digits starting 6-9. */
export const isValidPhone = (v: string) => /^[6-9]\d{9}$/.test(v.trim())
export const isValidPincode = (v: string) => /^[1-9]\d{5}$/.test(v.trim())
/** UPI reference numbers (UTR) are 12 digits. */
export const isValidUtr = (v: string) => /^\d{12}$/.test(v.trim())

export function mapsLink(parts: string[]): string {
  const query = parts.filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}
