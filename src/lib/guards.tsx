import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingState } from '@/components/states/LoadingState'
import { isValidPhone } from '@/domain/constants'
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
  if (!user) {
    // The admin area has its own sign-in page; everything else uses the public Google login.
    const adminOnly = roles.length === 1 && roles[0] === 'admin'
    return <Navigate to={adminOnly ? '/admin-login' : '/login'} replace state={{ from: location.pathname }} />
  }
  if (!user.role) return <Navigate to="/choose-role" replace />
  // Owners and students need a mobile number so libraries and students can reach each other.
  if (user.role !== 'admin' && !isValidPhone(user.phone)) return <Navigate to="/choose-role" replace />
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
