import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import type { Location } from 'react-router-dom'
import { Info, LogIn, UserPlus } from 'lucide-react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/Fields'
import { Logo } from '@/components/Logo'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import type { Profile, Role } from '@/domain/types'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { useMutation } from '@/hooks/useMutation'
import { useTitle } from '@/hooks/useTitle'
import { cx } from '@/lib/cx'
import { demoLogin } from '@/lib/container'

/** One-line scenario hints keyed by the seeded demo account id (from the build brief). */
const HINTS: Record<string, string> = {
  u_anil: 'Free trial, Morning shift full (39 of 39 seats)',
  u_sunita: 'Paid plan, running normally',
  u_manoj: 'Trial ending in 2 days · payment pending check',
  u_farah: 'Plan expired · library hidden',
  u_deepak: 'Library pending review',
  u_rekha: 'Library rejected · has a reason to fix',
  u_ibomcha: 'Paid plan in Imphal',
  u_riya: 'Has a membership · expiring in 7 days',
  u_aman: 'Two pending seat requests',
  u_sana: 'Looking for a seat',
  u_rahul: 'Looking for a seat',
  u_admin: 'Approves libraries and verifies payments',
}

type Group = { key: Role; label: string; accounts: Profile[] }

export default function Login() {
  useTitle('Sign in')
  const navigate = useNavigate()
  const location = useLocation() as Location & { state?: { from?: string } }
  const [params] = useSearchParams()
  const { user, loading: authLoading, signInAs, signUpNew } = useAuth()

  const asParam = params.get('as')
  const preferred: Role | null = asParam === 'owner' ? 'owner' : asParam === 'student' ? 'student' : null

  // Already signed in: send them home.
  if (!authLoading && user) {
    return <RedirectHome user={user} />
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">Sign in to StudySeat</h1>
        <p className="mt-2 text-ink-muted">
          {preferred === 'owner'
            ? 'List and run your study library.'
            : preferred === 'student'
              ? 'Find a library and request a seat.'
              : 'Continue to find a seat or run your library.'}
        </p>
      </div>

      {demoLogin ? (
        <DemoChooser
          demoLogin={demoLogin}
          preferred={preferred}
          onSignIn={async (id) => {
            const u = await signInAs(id)
            goAfterLogin(navigate, location, u)
          }}
          onSignUp={async (name, email) => {
            await signUpNew(name, email)
            navigate('/choose-role')
          }}
        />
      ) : (
        <RealGoogleSignIn />
      )}

      <p className="mt-8 text-center text-sm text-ink-muted">
        By continuing you agree to our{' '}
        <Link to="/terms" className="font-medium text-primary hover:text-primary-hover">terms</Link> and{' '}
        <Link to="/privacy" className="font-medium text-primary hover:text-primary-hover">privacy policy</Link>.
      </p>
    </div>
  )
}

function RedirectHome({ user }: { user: Profile }) {
  const navigate = useNavigate()
  useEffect(() => {
    navigate(homePathFor(user), { replace: true })
  }, [navigate, user])
  return null
}

function goAfterLogin(
  navigate: ReturnType<typeof useNavigate>,
  location: Location & { state?: { from?: string } },
  user: Profile,
) {
  const from = location.state?.from
  navigate(from ?? homePathFor(user), { replace: true })
}

function DemoChooser({
  demoLogin: demo,
  preferred,
  onSignIn,
  onSignUp,
}: {
  demoLogin: NonNullable<typeof demoLogin>
  preferred: Role | null
  onSignIn: (id: string) => Promise<void>
  onSignUp: (name: string, email: string) => Promise<void>
}) {
  const { data, error, loading, reload } = useAsync(() => demo.listAccounts(), [])
  const [pendingId, setPendingId] = useState<string | null>(null)

  const groups = useMemo<Group[]>(() => {
    const accounts = data ?? []
    const owners = accounts.filter((a) => a.role === 'owner')
    const students = accounts.filter((a) => a.role === 'student')
    const admins = accounts.filter((a) => a.role === 'admin')
    const all: Group[] = [
      { key: 'owner', label: 'Owners', accounts: owners },
      { key: 'student', label: 'Students', accounts: students },
      { key: 'admin', label: 'Admins', accounts: admins },
    ]
    return all.filter((g) => g.accounts.length > 0)
  }, [data])

  const [active, setActive] = useState<Role>(preferred ?? 'owner')

  // When the data or preference changes, make sure the active tab has accounts.
  useEffect(() => {
    if (groups.length === 0) return
    const wanted = preferred ?? active
    if (!groups.some((g) => g.key === wanted)) {
      setActive(groups[0].key)
    } else if (preferred && groups.some((g) => g.key === preferred)) {
      setActive(preferred)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, preferred])

  const handleSignIn = async (id: string) => {
    setPendingId(id)
    try {
      await onSignIn(id)
    } finally {
      setPendingId(null)
    }
  }

  const current = groups.find((g) => g.key === active) ?? groups[0]

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-start gap-3 rounded-card border border-border bg-primary-soft/60 px-4 py-3 text-sm text-ink">
        <Info aria-hidden className="mt-0.5 size-5 shrink-0 text-primary-ink" />
        <p className="min-w-0 break-words">
          <span className="font-medium">Demo mode:</span> no real Google sign-in. Pick a demo
          account to see the app as that person, or create a new account.
        </p>
      </div>

      {loading ? (
        <LoadingState label="Loading demo accounts" count={3} />
      ) : error ? (
        <ErrorState title="Couldn't load demo accounts" onRetry={reload} />
      ) : current ? (
        <section aria-labelledby="demo-accounts">
          <h2 id="demo-accounts" className="mb-2 text-sm font-semibold text-ink-muted">
            Demo accounts
          </h2>

          {/* Tabs keep the three groups compact on a phone. */}
          <div role="tablist" aria-label="Demo account type" className="flex gap-1.5">
            {groups.map((g) => {
              const selected = g.key === active
              return (
                <button
                  key={g.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(g.key)}
                  className={cx(
                    'min-h-11 min-w-0 flex-1 rounded-control border px-2 text-sm font-medium transition-colors',
                    selected
                      ? 'border-primary bg-primary-soft text-primary-ink'
                      : 'border-border-strong bg-surface text-ink hover:bg-canvas',
                  )}
                >
                  {g.label}
                  {preferred === g.key && <span className="ml-1 hidden sm:inline">(for you)</span>}
                </button>
              )
            })}
          </div>

          <ul data-card-grid role="list" className="mt-3 grid items-stretch gap-3 md:grid-cols-2">
            {current.accounts.map((acc) => (
              <li key={acc.id} className="flex min-w-0">
                <button
                  type="button"
                  onClick={() => void handleSignIn(acc.id)}
                  disabled={pendingId !== null}
                  className="flex min-h-11 w-full min-w-0 flex-1 items-start gap-3 rounded-card border border-border bg-surface p-4 text-left transition-colors hover:bg-canvas disabled:cursor-progress disabled:opacity-70"
                >
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-ink"
                  >
                    {initials(acc.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{acc.name}</span>
                    <span className="block truncate text-xs text-ink-muted">{acc.email}</span>
                    {/* Reserve two lines for the scenario hint so every card is the same height. */}
                    <span className="mt-1 block min-h-[2rem] text-xs text-ink-muted">
                      {HINTS[acc.id] ?? ''}
                    </span>
                  </span>
                  <LogIn
                    aria-hidden
                    className={cx('mt-0.5 size-4 shrink-0 text-ink-muted', pendingId === acc.id && 'motion-safe:animate-pulse')}
                  />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <NewAccountForm onSignUp={onSignUp} />
    </div>
  )
}

function NewAccountForm({ onSignUp }: { onSignUp: (name: string, email: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const { run, loading, error } = useMutation(
    (n: string, e: string) => onSignUp(n, e),
    { silent: true },
  )

  const trimmedName = name.trim()
  const trimmedEmail = email.trim()
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
  const canSubmit = trimmedName.length > 0 && emailOk

  if (!open) {
    return (
      <section aria-labelledby="new-account">
        <h2 id="new-account" className="mb-2 text-sm font-semibold text-ink-muted">
          New here
        </h2>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full min-h-11 max-w-full items-center gap-3 rounded-card border border-border-strong bg-surface px-4 py-3 text-left transition-colors hover:bg-canvas"
        >
          <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-canvas text-ink-muted">
            <UserPlus className="size-5" />
          </span>
          <span className="min-w-0 break-words font-medium text-ink">Use a new Google account</span>
        </button>
      </section>
    )
  }

  return (
    <section aria-labelledby="new-account">
      <h2 id="new-account" className="mb-2 text-sm font-semibold text-ink-muted">
        Use a new Google account
      </h2>
      <Card className="p-5">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) void run(trimmedName, trimmedEmail)
          }}
        >
          <TextField
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            error={email.length > 0 && !emailOk ? 'Enter a valid email address.' : undefined}
          />
          {error && <p className="text-sm font-medium text-danger">{error.message}</p>}
          <div className="flex gap-3">
            <Button type="submit" loading={loading} disabled={!canSubmit}>
              Continue
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </section>
  )
}

function RealGoogleSignIn() {
  return (
    <Card className="mt-8 p-6 text-center">
      <p className="text-ink-muted">Sign in with your Google account to continue.</p>
      <Button className="mt-4 w-full" disabled>
        Continue with Google
      </Button>
      <p className="mt-3 text-sm text-ink-muted">
        Google sign-in is configured in production builds.
      </p>
    </Card>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
