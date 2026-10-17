import { Clock, TriangleAlert } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { memberDaysLeft } from '@/domain/members'
import type { Member } from '@/domain/types'

/** "5 days left" / "Expires today" / "Overdue by 2 days", colour + icon, never colour alone. */
function daysLeftText(days: number): string {
  if (days < 0) return `Overdue by ${-days} day${days === -1 ? '' : 's'}`
  if (days === 0) return 'Expires today'
  return `${days} day${days === 1 ? '' : 's'} left`
}

export function ExpiryBadge({ member, today }: { member: Pick<Member, 'expiryDate'>; today: string }) {
  const days = memberDaysLeft(member, today)
  if (days < 0) {
    return (
      <Badge tone="danger" icon={<TriangleAlert />}>
        {daysLeftText(days)}
      </Badge>
    )
  }
  if (days <= 7) {
    return (
      <Badge tone="warning" icon={<Clock />}>
        {daysLeftText(days)}
      </Badge>
    )
  }
  return <Badge tone="success">{daysLeftText(days)}</Badge>
}
