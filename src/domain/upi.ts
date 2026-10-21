export type UpiLinkInput = {
  /** The payee's UPI ID (VPA), e.g. name@oksbi. */
  upiId: string
  /** The name shown to the payer. */
  payeeName: string
  /** Whole paise. 19900 = Rs 199.00. */
  amountPaise: number
  /** What the payer sees and what lands in the statement. */
  note: string
}

/** RFC 3986 encoding: encodeURIComponent also leaves ! ' ( ) * as they are, which the UPI link spec does not want. */
function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)
}

/**
 * The payment link behind the "Pay with a UPI app" button and the QR code (they share this one string).
 * Format: NPCI UPI linking specification, upi://pay?pa=&pn=&am=&cu=&tn=
 */
export function buildUpiLink({ upiId, payeeName, amountPaise, note }: UpiLinkInput): string {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new Error('The amount must be a positive whole number of paise.')
  const amount = (amountPaise / 100).toFixed(2)
  return `upi://pay?pa=${encode(upiId)}&pn=${encode(payeeName)}&am=${amount}&cu=INR&tn=${encode(note)}`
}