import { createStore, useStore } from '@/lib/store'

/**
 * Remembers which updates a person has already dismissed ("Your payment was verified").
 * Kept per user in this browser. Real mode will store this in the database instead.
 */
const KEY = 'studyseat.seenUpdates'

function read(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string[]>
  } catch {
    return {}
  }
}

export const seenStore = createStore<Record<string, string[]>>(read())

export function markSeen(userId: string, ids: string[]) {
  const next = { ...seenStore.get(), [userId]: [...new Set([...(seenStore.get()[userId] ?? []), ...ids])] }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* private mode: dismissals last for this visit only */
  }
  seenStore.set(next)
}

export function useSeen(userId: string | undefined): Set<string> {
  const all = useStore(seenStore)
  return new Set(userId ? (all[userId] ?? []) : [])
}
