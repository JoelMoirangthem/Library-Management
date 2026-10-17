import { useCallback, useEffect, useState } from 'react'

/** Shows `pageSize` items at a time. Resets to the first page when `resetKey` changes (filters, search). */
export function usePaged<T>(items: T[], pageSize = 25, resetKey: unknown = '') {
  const [count, setCount] = useState(pageSize)

  useEffect(() => {
    setCount(pageSize)
  }, [resetKey, pageSize])

  const showMore = useCallback(() => setCount((c) => c + pageSize), [pageSize])

  return {
    visible: items.slice(0, count),
    total: items.length,
    shown: Math.min(count, items.length),
    hasMore: count < items.length,
    showMore,
  }
}
