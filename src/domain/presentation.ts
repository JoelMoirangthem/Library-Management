export type AvailabilityTone = 'neutral' | 'warning' | 'success'
export type AttentionKind = 'request' | 'overdue' | 'expiring'

export type AttentionInput = {
  id: string
  kind: AttentionKind
  createdAt?: string
  daysLeft?: number
}

export function cardColumnsFor(count: number): 1 | 2 | 3 {
  if (count <= 1) return 1
  if (count === 2 || count === 4) return 2
  return 3
}

export function availabilityLabel(seatsLeft: number): { label: string; tone: AvailabilityTone } {
  if (seatsLeft <= 0) return { label: 'Full', tone: 'neutral' }
  if (seatsLeft <= 5) return { label: `${seatsLeft} free`, tone: 'warning' }
  return { label: `${seatsLeft} free`, tone: 'success' }
}

const priority = { request: 0, overdue: 1, expiring: 2 } as const

export function rankAttention(items: AttentionInput[]): AttentionInput[] {
  return [...items].sort((a, b) => {
    const type = priority[a.kind] - priority[b.kind]
    if (type !== 0) return type
    if (a.kind === 'request') return (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
    return (a.daysLeft ?? 0) - (b.daysLeft ?? 0)
  })
}

export function limitVisible<T>(items: T[], limit: number): { visible: T[]; remaining: number } {
  return { visible: items.slice(0, limit), remaining: Math.max(0, items.length - limit) }
}
