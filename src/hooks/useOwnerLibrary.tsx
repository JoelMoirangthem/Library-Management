import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { AppError } from '@/domain/errors'
import { canEditProfile, canOwnerWrite, planDaysLeft, planState, type PlanState } from '@/domain/plan'
import type { Library, Subscription } from '@/domain/types'
import { useAsync } from '@/hooks/useAsync'
import { services } from '@/lib/container'
import { useNow } from '@/lib/devState'

export type OwnerLibraryContext = {
  /** The owner's library, or null before they have created one. */
  library: Library | null
  subscription: Subscription | null
  /** 'none' = no library yet (show SetupState). */
  state: PlanState | 'none'
  /** BR-6: false when pending, rejected or expired. Disable every write control. */
  canWrite: boolean
  canEditProfile: boolean
  /** Whole days of plan left (0 when expired or not started). */
  daysLeft: number
  loading: boolean
  error: AppError | null
  reload: () => void
}

const Ctx = createContext<OwnerLibraryContext | null>(null)

/** Loads the signed-in owner's library + subscription once for all owner pages. */
export function OwnerLibraryProvider({ children }: { children: ReactNode }) {
  const now = useNow()
  const lib = useAsync(() => services.getMyLibrary(), [])
  const libraryId = lib.data?.id ?? null
  const sub = useAsync(
    () => (libraryId ? services.getSubscription(libraryId) : Promise.resolve(null)),
    [libraryId],
  )

  const value = useMemo<OwnerLibraryContext>(() => {
    const library = lib.data
    const subscription = sub.data
    const state: PlanState | 'none' = library ? planState(library, subscription, now) : 'none'
    return {
      library,
      subscription,
      state,
      canWrite: state !== 'none' && canOwnerWrite(state),
      canEditProfile: state === 'none' || canEditProfile(state),
      daysLeft: planDaysLeft(subscription, now),
      loading: lib.loading || (libraryId !== null && sub.loading),
      error: lib.error ?? sub.error,
      reload: () => {
        lib.reload()
        sub.reload()
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib.data, sub.data, lib.loading, sub.loading, lib.error, sub.error, now, libraryId])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useOwnerLibrary(): OwnerLibraryContext {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useOwnerLibrary must be used inside <OwnerLibraryProvider>')
  return ctx
}
