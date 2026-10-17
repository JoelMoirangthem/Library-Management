import { createStore, useStore } from '@/lib/store'

/**
 * Dummy-mode dev controls. All pure rule functions take `now` as a parameter;
 * this store is the single place the app asks "what time is it".
 */
const STORAGE_KEY = 'studyseat.clockOffsetDays'

function readOffset(): number {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

export const clockStore = createStore<{ offsetDays: number }>({ offsetDays: readOffset() })

export function getNow(): Date {
  return new Date(Date.now() + clockStore.get().offsetDays * 86_400_000)
}

export function setClockOffsetDays(days: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(days))
  } catch {
    /* storage unavailable: offset lasts for this session only */
  }
  clockStore.set({ offsetDays: days })
}

/** Re-renders when the fake date changes. */
export function useNow(): Date {
  const { offsetDays } = useStore(clockStore)
  // The offset is the dependency: a new Date per offset is stable enough for rendering.
  void offsetDays
  return getNow()
}

export type DevFlags = {
  /** Simulated network delay in ms. */
  latencyMs: number
  forceLoading: boolean
  forceError: boolean
}

export const devFlags = createStore<DevFlags>({ latencyMs: 250, forceLoading: false, forceError: false })

/** Bumped after every mock write so every mounted query refetches. */
export const dataVersion = createStore<number>(0)
