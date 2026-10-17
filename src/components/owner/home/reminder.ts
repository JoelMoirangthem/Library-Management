import { formatDate } from '@/domain/dates'

/** Polite renewal reminder pre-filled for WhatsApp. */
export function reminderMessage(opts: {
  name: string
  shift: string
  library: string
  expiry: string
}): string {
  return `Hi ${opts.name}, your ${opts.shift} seat at ${opts.library} ends on ${formatDate(
    opts.expiry,
  )}. Please renew to keep it. Thank you.`
}
