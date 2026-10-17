import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Profile, Role } from '@/domain/types'
import { demoLogin, services } from '@/lib/container'
import { dataVersion } from '@/lib/devState'
import { useStore } from '@/lib/store'

type AuthApi = {
  user: Profile | null
  /** True until the first session check finishes. */
  loading: boolean
  /** Mock mode: stands in for Google sign-in. */
  signInAs: (userId: string) => Promise<Profile>
  /** Mock mode: a brand new Google user with no role yet. */
  signUpNew: (name: string, email: string) => Promise<Profile>
  signOut: () => Promise<void>
  chooseRole: (role: 'student' | 'owner') => Promise<Profile>
  updateProfile: (patch: { name: string; phone: string }) => Promise<Profile>
}

const AuthContext = createContext<AuthApi | null>(null)

/** Where each role lands after signing in. */
export function homePathFor(user: Profile | null): string {
  if (!user) return '/'
  switch (user.role) {
    case 'admin':
      return '/admin'
    case 'owner':
      return '/owner'
    case 'student':
      return '/discover'
    default:
      return '/choose-role'
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const version = useStore(dataVersion)
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Re-read the session after every write (role chosen, profile edited, account switched).
  useEffect(() => {
    let cancelled = false
    services
      .getSession()
      .then((u) => !cancelled && setUser(u))
      .catch(() => !cancelled && setUser(null))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [version])

  const signInAs = useCallback(async (id: string) => {
    if (!demoLogin) throw new Error('Demo sign-in is only available in mock mode.')
    const u = await demoLogin.signInAs(id)
    setUser(u)
    return u
  }, [])

  const signUpNew = useCallback(async (name: string, email: string) => {
    if (!demoLogin) throw new Error('Demo sign-in is only available in mock mode.')
    const u = await demoLogin.signUpNewUser(name, email)
    setUser(u)
    return u
  }, [])

  const signOut = useCallback(async () => {
    await services.signOut()
    setUser(null)
  }, [])

  const chooseRole = useCallback(async (role: 'student' | 'owner') => {
    const u = await services.chooseRole(role)
    setUser(u)
    return u
  }, [])

  const updateProfile = useCallback(async (patch: { name: string; phone: string }) => {
    const u = await services.updateProfile(patch)
    setUser(u)
    return u
  }, [])

  const api = useMemo<AuthApi>(
    () => ({ user, loading, signInAs, signUpNew, signOut, chooseRole, updateProfile }),
    [user, loading, signInAs, signUpNew, signOut, chooseRole, updateProfile],
  )

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export type { Role }
