import type { BadgeTone } from '@/components/Badge'
import { formatDate } from '@/domain/dates'
import { planDaysLeft, type PlanState } from '@/domain/plan'
import type { Subscription } from '@/domain/types'

export type StatusView = { tone: BadgeTone; label: string }

function dayWord(n: number): string {
  if (n <= 0) return 'expires today'
  return n === 1 ? '1 day left' : `${n} days left`
}

/** Maps a computed plan state to a badge tone + words. */
export function planStatusView(state: PlanState, sub: Subscription | null, now: Date): StatusView {
  switch (state) {
    case 'pending':
      return { tone: 'accent', label: 'Pending review' }
    case 'rejected':
      return { tone: 'danger', label: 'Rejected' }
    case 'trial': {
      const n = planDaysLeft(sub, now)
      return { tone: n <= 3 ? 'accent' : 'primary', label: `Trial, ${dayWord(n)}` }
    }
    case 'paid': {
      const n = planDaysLeft(sub, now)
      return { tone: n <= 3 ? 'warning' : 'success', label: `Paid, ${dayWord(n)}` }
    }
    case 'expired':
      return { tone: 'neutral', label: 'Expired' }
  }
}

/** When a plan would run until, as `24 Nov 2026`, from an extended Date. */
export function formatUntil(d: Date): string {
  return formatDate(d.toISOString().slice(0, 10))
}
