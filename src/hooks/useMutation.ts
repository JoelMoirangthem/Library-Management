import { useCallback, useEffect, useRef, useState } from 'react'
import { toAppError, type AppError } from '@/domain/errors'
import { useToast } from '@/components/Toast'

type Options<R> = {
  /** Toast shown on success, in the same words as the button, e.g. "Saved". */
  success?: string
  /** Set to handle errors inline (e.g. under a form field) instead of a toast. */
  silent?: boolean
  onSuccess?: (result: R) => void
}

/**
 * Wraps a write. `run` resolves to the result, or undefined if it failed (the error is
 * in `error`, and shown as a toast unless `silent`).
 */
export function useMutation<A extends unknown[], R>(fn: (...args: A) => Promise<R>, options: Options<R> = {}) {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<AppError | null>(null)

  // run() is memoised, so it must read the LATEST options when the save finishes. Reading them from the first
  // render made messages built from later data stale (Renew said "Renewed" instead of "Renewed until 16 Jan").
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setLoading(true)
      setError(null)
      try {
        const result = await fn(...args)
        const latest = optionsRef.current
        if (latest.success) toast.show(latest.success, 'success')
        latest.onSuccess?.(result)
        // Writes that return nothing still need a value that differs from the failure
        // value (undefined), so callers can write `if (await run(...) !== undefined)`.
        return result === undefined ? (true as unknown as R) : result
      } catch (e) {
        const err = toAppError(e)
        setError(err)
        if (!optionsRef.current.silent) toast.show(err.message, 'error')
        return undefined
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, toast],
  )

  return { run, loading, error, clearError: () => setError(null) }
}
