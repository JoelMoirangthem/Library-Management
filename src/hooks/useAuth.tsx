import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Wrench } from 'lucide-react'
import type { Profile, Role } from '@/domain/types'
import { StateShell } from '@/components/states/StateShell'
import { demoLogin, services } from '@/lib/container'
import { dataVersion } from '@/lib/devState'
import { isConfigError } from '@/lib/env'
import { useStore } from '@/lib/store'

type AuthApi = {
  user: Profile | null
  /** True until the first session check finishes. */
  loading: boolean
  /** Mock mode: stands in for Google sign-in. */
  signInAs: (userId: string) => Promise<Profile>
  /** Mock mode: a brand new Google user with no role yet. */
  signUpNew: (name: string, email: string) => Promise<Profile>
  /** Real mode: sends the browser to Google. */
  signInWithGoogle: () => Promise<void>
  signInAdmin: (userId: string, password: string) => Promise<void>
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
  // A missing Supabase URL/key is a setup problem, not "signed out". Surface it instead of a blank, logged-out site.
  const [configError, setConfigError] = useState<Error | null>(null)

  // Re-read the session after every write (role chosen, profile edited, account switched).
  useEffect(() => {
    let cancelled = false
    services
      .getSession()
      .then((u) => !cancelled && setUser(u))
      .catch((e: unknown) => {
        if (cancelled) return
        if (isConfigError(e)) {
          setConfigError(e as Error)
        } else {
          // A real "no session" (or a transient read failure): treat as signed out.
          setUser(null)
        }
      })
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

  const signInWithGoogle = useCallback(async () => {
    await services.signInWithGoogle()
  }, [])

  const signInAdmin = useCallback(async (userId: string, password: string) => {
    setUser(await services.signInAdmin(userId, password))
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
    () => ({ user, loading, signInAs, signUpNew, signInWithGoogle, signInAdmin, signOut, chooseRole, updateProfile }),
    [user, loading, signInAs, signUpNew, signInWithGoogle, signInAdmin, signOut, chooseRole, updateProfile],
  )

  if (configError) {
    return (
      <StateShell
        role="alert"
        tone="danger"
        heading="h1"
        icon={<Wrench className="size-6" />}
        title="StudySeat isn't set up yet"
        description={configError.message}
      />
    )
  }

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

export type { Role }
