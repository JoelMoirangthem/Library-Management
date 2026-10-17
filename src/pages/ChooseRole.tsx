import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, LoaderCircle, Store } from 'lucide-react'
import { Logo } from '@/components/Logo'
import type { Role } from '@/domain/types'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { cx } from '@/lib/cx'

type Choice = Exclude<Role, 'admin'>

export default function ChooseRole() {
  const navigate = useNavigate()
  const { user, loading, chooseRole } = useAuth()
  const [pending, setPending] = useState<Choice | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Already has a role: send them to their home.
  useEffect(() => {
    if (!loading && user?.role) {
      navigate(homePathFor(user), { replace: true })
    }
  }, [loading, user, navigate])

  if (loading || (user && user.role)) return null

  const pick = async (role: Choice) => {
    if (pending) return
    setPending(role)
    setError(null)
    try {
      const updated = await chooseRole(role)
      navigate(homePathFor(updated), { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your choice. Try again.')
      setPending(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">How will you use StudySeat?</h1>
        <p className="mt-2 text-ink-muted">Pick the one that fits you.</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <RoleCard
          role="student"
          icon={<GraduationCap className="size-7" />}
          title="I'm looking for a seat"
          body="Search libraries by city and area, see free seats, and request a spot."
          busy={pending === 'student'}
          disabled={pending !== null && pending !== 'student'}
          onPick={() => void pick('student')}
        />
        <RoleCard
          role="owner"
          icon={<Store className="size-7" />}
          title="I run a study library"
          body="List your library and manage seats, students, fees and expiry in one place."
          busy={pending === 'owner'}
          disabled={pending !== null && pending !== 'owner'}
          onPick={() => void pick('owner')}
        />
      </div>

      {error && (
        <p role="alert" className="mt-4 text-center text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <p className="mt-6 text-center text-sm text-ink-muted">
        This choice is permanent — it cannot be changed later.
      </p>
    </div>
  )
}

function RoleCard({
  role,
  icon,
  title,
  body,
  busy,
  disabled,
  onPick,
}: {
  role: Choice
  icon: React.ReactNode
  title: string
  body: string
  busy: boolean
  disabled: boolean
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={disabled || busy}
      aria-label={`${title}. This choice is permanent.`}
      className={cx(
        'group flex h-full flex-col items-start rounded-card border bg-surface p-6 text-left transition-colors',
        'border-border hover:border-primary hover:bg-primary-soft/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        (disabled || busy) && 'cursor-not-allowed opacity-70',
      )}
    >
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-ink"
      >
        {busy ? <LoaderCircle className="size-7 motion-safe:animate-spin" /> : icon}
      </span>
      <span className="mt-4 text-lg font-semibold text-ink">{title}</span>
      <span className="mt-1 text-sm text-ink-muted">{body}</span>
      <span className="mt-4 text-sm font-medium text-primary group-hover:text-primary-hover">
        {busy ? 'Setting up…' : role === 'student' ? 'Continue as student' : 'Continue as owner'}
      </span>
    </button>
  )
}
