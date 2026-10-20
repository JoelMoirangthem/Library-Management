import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/Fields'
import { Logo } from '@/components/Logo'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { useTitle } from '@/hooks/useTitle'
import { dataMode } from '@/lib/container'

/**
 * The administrator's own sign-in, separate from the public Google login. It is not linked from the public site.
 * The database decides who is an administrator; this page only signs in and then checks the role.
 */
export default function AdminLogin() {
  useTitle('Administrator sign-in')
  const { user, loading, signInAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Already signed in as an administrator: go straight in.
  if (!loading && user?.role === 'admin') return <Navigate to="/admin" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await signInAdmin(userId, password)
      const from = (location.state as { from?: string } | null)?.from
      // Only paths inside the admin area are accepted as a place to return to.
      navigate(from && /^\/admin(\/|$)/.test(from) ? from : '/admin', { replace: true })
    } catch (err) {
      setPassword('')
      setError(err instanceof Error ? err.message : 'Could not sign in.')
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex justify-center">
        <Logo to="/" />
      </div>
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck aria-hidden className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Administrator sign-in</h1>
        </div>

        {user && user.role !== 'admin' && (
          <p className="mb-4 rounded-control bg-warning-soft px-3 py-2 text-sm text-warning-ink">
            You are signed in as another kind of account. Signing in here replaces that session.{' '}
            <button type="button" className="font-medium text-primary underline" onClick={() => void signOut()}>
              Sign out first
            </button>
          </p>
        )}

        {dataMode === 'mock' ? (
          <p className="text-sm text-ink-muted">Password sign-in is only available on the live site. In demo mode use the demo admin account on the login page.</p>
        ) : (
          <form onSubmit={(e) => void submit(e)} noValidate className="space-y-4">
            <TextField
              label="User ID"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              required
            />
            <TextField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={busy} disabled={!userId.trim() || !password}>
              Sign in
            </Button>
          </form>
        )}
      </Card>
      <p className="mt-4 text-center text-sm text-ink-muted">
        {user ? <a className="underline" href={homePathFor(user)}>Back to your account</a> : <a className="underline" href="/">Back to the site</a>}
      </p>
    </main>
  )
}