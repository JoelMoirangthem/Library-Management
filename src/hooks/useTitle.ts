import { useEffect } from 'react'

/** Gives each page its own browser tab title: "Seats · StudySeat". */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · StudySeat` : 'StudySeat'
    return () => {
      document.title = previous
    }
  }, [title])
}
