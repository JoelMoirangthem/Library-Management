import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '@/components/states/LoadingState'
import type { Role } from '@/domain/types'
import { homePathFor, useAuth } from '@/hooks/useAuth'

/**
 * Route guard. Frontend guards are for fast redirects and the right home page only;
 * the database enforces who can actually read or write what.
 */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <LoadingState label="Checking your account" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!user.role) return <Navigate to="/choose-role" replace />
  if (!roles.includes(user.role)) return <Navigate to={homePathFor(user)} replace />
  return <Outlet />
}

/** Signed in, any state (used by the role chooser). */
export function RequireSignedIn() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
