import { useEffect, useRef, useState } from 'react'
import { toAppError, type AppError } from '@/domain/errors'
import { dataVersion, devFlags } from '@/lib/devState'
import { useStore } from '@/lib/store'

export type AsyncState<T> = {
  data: T | null
  error: AppError | null
  /** True only on the first load (no data yet). Use this to show skeletons. */
  loading: boolean
  /** True while refetching with data already on screen. */
  refreshing: boolean
  reload: () => void
}

/**
 * Loads data and keeps it fresh: refetches whenever `deps` change, after any mock write
 * (the data-version bumps), and on `reload()`. The dev panel can force loading/error states.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[] = []): AsyncState<T> {
  const version = useStore(dataVersion)
  const { forceLoading } = useStore(devFlags)
  const [tick, setTick] = useState(0)
  const [state, setState] = useState<{ data: T | null; error: AppError | null; busy: boolean }>({
    data: null,
    error: null,
    busy: true,
  })
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, busy: true }))
    fnRef
      .current()
      .then((data) => !cancelled && setState({ data, error: null, busy: false }))
      .catch((e: unknown) => !cancelled && setState((s) => ({ data: s.data, error: toAppError(e), busy: false })))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick, ...deps])

  const hasData = state.data !== null
  return {
    data: forceLoading ? null : state.data,
    error: forceLoading ? null : state.error,
    loading: forceLoading || (state.busy && !hasData && !state.error),
    refreshing: state.busy && hasData,
    reload: () => setTick((t) => t + 1),
  }
}
