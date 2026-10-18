import { describe, expect, it } from 'vitest'
import {
  availabilityLabel,
  cardColumnsFor,
  limitVisible,
  rankAttention,
} from '@/domain/presentation'

describe('cardColumnsFor', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 2],
    [5, 3],
  ] as const)('uses %i clean columns for %i records', (count, expected) => {
    expect(cardColumnsFor(count)).toBe(expected)
  })
})

describe('availabilityLabel', () => {
  it('writes status in words, not colour only', () => {
    expect(availabilityLabel(0)).toEqual({ label: 'Full', tone: 'neutral' })
    expect(availabilityLabel(3)).toEqual({ label: '3 free', tone: 'warning' })
    expect(availabilityLabel(18)).toEqual({ label: '18 free', tone: 'success' })
  })
})

describe('rankAttention', () => {
  it('orders request before overdue before expiring, then urgent records first', () => {
    const ranked = rankAttention([
      { id: 'expire-3', kind: 'expiring', daysLeft: 3 },
      { id: 'overdue-2', kind: 'overdue', daysLeft: -2 },
      { id: 'request-old', kind: 'request', createdAt: '2026-10-10T10:00:00Z' },
      { id: 'overdue-6', kind: 'overdue', daysLeft: -6 },
      { id: 'request-new', kind: 'request', createdAt: '2026-10-16T10:00:00Z' },
    ])
    expect(ranked.map((item) => item.id)).toEqual([
      'request-old', 'request-new', 'overdue-6', 'overdue-2', 'expire-3',
    ])
  })
})

describe('limitVisible', () => {
  it('returns visible records and a remaining count', () => {
    expect(limitVisible(['a', 'b', 'c'], 2)).toEqual({ visible: ['a', 'b'], remaining: 1 })
  })
})
