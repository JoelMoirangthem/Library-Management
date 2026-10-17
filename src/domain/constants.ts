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

/**
 * Pasted numbers arrive as "+91 98765 43210", "098765-43210" or "98765 43210". Keep the 10 digits.
 */
export function normalizePhone(v: string): string {
  let d = v.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2)
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1)
  return d
}

/** Indian mobile number: 10 digits starting 6-9, after cleaning up spaces, dashes, +91 and a leading 0. */
export const isValidPhone = (v: string) => /^[6-9]\d{9}$/.test(normalizePhone(v))

/** "98765 43210" for display. */
export function formatPhone(v: string): string {
  const d = normalizePhone(v)
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : v
}
export const isValidPincode = (v: string) => /^[1-9]\d{5}$/.test(v.trim())
/** UPI reference numbers (UTR) are 12 digits. */
export const isValidUtr = (v: string) => /^\d{12}$/.test(v.trim())

export function mapsLink(parts: string[]): string {
  const query = parts.filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

/** Opens WhatsApp with a ready-to-send message. A plain link: no integration, no API, works on any phone. */
export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/91${normalizePhone(phone)}?text=${encodeURIComponent(message)}`
}