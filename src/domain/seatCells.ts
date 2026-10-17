import { memberDaysLeft, memberPhase } from '@/domain/members'
import type { Member, Seat } from '@/domain/types'

export type SeatCellState = 'free' | 'occupied' | 'expiring' | 'overdue' | 'disabled'

export type SeatCell = {
  id: string
  number: number
  state: SeatCellState
  /** Spoken label, e.g. "Seat 12, occupied by Ravi, expires in 5 days". */
  label: string
}

function expiryPhrase(days: number): string {
  if (days < 0) return `overdue by ${-days} day${days === -1 ? '' : 's'}`
  if (days === 0) return 'expires today'
  return `expires in ${days} day${days === 1 ? '' : 's'}`
}

/**
 * Occupied seats are computed from active members of ONE shift, never stored on the seat, so the grid
 * can never disagree with the member list (BR-10). The same seat can be free in one shift and taken in another. A seat stays occupied past expiry
 * ("overdue") until the owner frees it.
 */
export function buildSeatCells(
  seats: Seat[],
  members: Member[],
  today: string,
  shiftId: string,
): SeatCell[] {
  const bySeat = new Map<string, Member>()
  for (const m of members) {
    if (m.status === 'active' && m.seatId && m.shiftId === shiftId) bySeat.set(m.seatId, m)
  }

  return seats
    .slice()
    .sort((a, b) => a.seatNumber - b.seatNumber)
    .map((s): SeatCell => {
      if (!s.isActive) {
        return { id: s.id, number: s.seatNumber, state: 'disabled', label: `Seat ${s.seatNumber}, not in use` }
      }
      const m = bySeat.get(s.id)
      if (!m) return { id: s.id, number: s.seatNumber, state: 'free', label: `Seat ${s.seatNumber}, free` }
      const phase = memberPhase(m, today)
      const days = memberDaysLeft(m, today)
      return {
        id: s.id,
        number: s.seatNumber,
        state: phase === 'expired' ? 'overdue' : phase === 'expiring' ? 'expiring' : 'occupied',
        label: `Seat ${s.seatNumber}, occupied by ${m.name}, ${expiryPhrase(days)}`,
      }
    })
}

export function seatCounts(cells: SeatCell[]) {
  const usable = cells.filter((c) => c.state !== 'disabled')
  const free = usable.filter((c) => c.state === 'free').length
  return { total: usable.length, free, occupied: usable.length - free }
}
