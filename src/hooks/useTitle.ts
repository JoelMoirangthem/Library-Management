import { useEffect } from 'react'
import { BRAND } from '@/lib/brand'

/** Gives each page its own browser tab title: "Seats · NearMe Library". */
export function useTitle(title: string | null | undefined) {
  useEffect(() => {
    const previous = document.title
    document.title = title ? `${title} · ${BRAND.name}` : BRAND.name
    return () => {
      document.title = previous
    }
  }, [title])
}
