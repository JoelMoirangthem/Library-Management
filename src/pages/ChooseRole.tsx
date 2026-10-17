import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Store } from 'lucide-react'
import { Button } from '@/components/Button'
import { TextField } from '@/components/Fields'
import { Logo } from '@/components/Logo'
import { Steps, type StepState } from '@/components/Steps'
import { formatPhone, isValidPhone, normalizePhone } from '@/domain/constants'
import type { Role } from '@/domain/types'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { useMutation } from '@/hooks/useMutation'
import { useTitle } from '@/hooks/useTitle'
import { cx } from '@/lib/cx'

type Choice = Exclude<Role, 'admin'>

export default function ChooseRole() {
  useTitle('Set up your account')
  const navigate = useNavigate()
  const { user, loading, chooseRole, updateProfile } = useAuth()

  const hasRole = !!user?.role && user.role !== 'admin'
  const hasPhone = !!user && isValidPhone(user.phone)

  // Role and phone already set: nothing to do here.
  useEffect(() => {
    if (!loading && user && hasRole && hasPhone) {
      navigate(homePathFor(user), { replace: true })
    }
  }, [loading, user, hasRole, hasPhone, navigate])

  // Which step to show. When the role is already set, there's only the details step.
  // Otherwise the local `advanced` flag moves from role selection to details.
  const [role, setRole] = useState<Choice | null>(null)
  const [advanced, setAdvanced] = useState(false)

  if (loading || !user || (hasRole && hasPhone)) return null

  const step: 1 | 2 = hasRole || advanced ? 2 : 1
  const effectiveRole: Choice | null = (user.role as Choice | null) ?? role

  const stepStates: StepState[] = step === 1 ? ['current', 'todo'] : ['done', 'current']

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <Logo />
        <h1 className="mt-6 text-2xl font-semibold sm:text-3xl">
          {step === 1 ? 'How will you use StudySeat?' : 'Your details'}
        </h1>
        <p className="mt-2 text-ink-muted">
          {step === 1
            ? 'Pick the one that fits you.'
            : 'We need a name and number so people can reach you.'}
        </p>
      </div>

      <Steps
        className="mt-8"
        steps={[
          { label: 'I am a…', state: stepStates[0] },
          { label: 'Your details', state: stepStates[1] },
        ]}
      />

      <div className="mt-8">
        {step === 1 ? (
          <RoleStep
            value={role}
            onChange={setRole}
            onContinue={() => role && setAdvanced(true)}
          />
        ) : (
          <DetailsStep
            role={effectiveRole}
            initialName={user.name}
            initialPhone={user.phone}
            canGoBack={!hasRole}
            onBack={() => setAdvanced(false)}
            onSave={async (name, phone) => {
              // Persist the chosen role first (only when it isn't set yet).
              if (!hasRole && role) await chooseRole(role)
              const updated = await updateProfile({ name, phone })
              navigate(homePathFor(updated), { replace: true })
            }}
          />
        )}
      </div>
    </div>
  )
}

function RoleStep({
  value,
  onChange,
  onContinue,
}: {
  value: Choice | null
  onChange: (role: Choice) => void
  onContinue: () => void
}) {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <RoleCard
          selected={value === 'student'}
          icon={<GraduationCap className="size-7" />}
          title="I'm looking for a seat"
          body="Search libraries by city and area, see free seats, and request a spot."
          cta="Choose student"
          onPick={() => onChange('student')}
        />
        <RoleCard
          selected={value === 'owner'}
          icon={<Store className="size-7" />}
          title="I run a study library"
          body="List your library and manage seats, students, fees and expiry in one place."
          cta="Choose owner"
          onPick={() => onChange('owner')}
        />
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        This choice is permanent — it cannot be changed later.
      </p>

      <Button className="mt-4 w-full" disabled={!value} onClick={onContinue}>
        Continue
      </Button>
    </div>
  )
}

function RoleCard({
  selected,
  icon,
  title,
  body,
  cta,
  onPick,
}: {
  selected: boolean
  icon: React.ReactNode
  title: string
  body: string
  cta: string
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cx(
        'group flex h-full min-h-11 flex-col items-start rounded-card border bg-surface p-6 text-left transition-colors',
        selected ? 'border-primary bg-primary-soft/40 ring-1 ring-primary' : 'border-border hover:border-primary hover:bg-primary-soft/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
      )}
    >
      <span
        aria-hidden
        className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-ink"
      >
        {icon}
      </span>
      <span className="mt-4 text-lg font-semibold text-ink">{title}</span>
      <span className="mt-1 min-w-0 break-words text-sm text-ink-muted">{body}</span>
      <span className="mt-auto pt-4 text-sm font-medium text-primary group-hover:text-primary-hover">
        {selected ? 'Selected' : cta}
      </span>    </button>
  )
}

function DetailsStep({
  role,
  initialName,
  initialPhone,
  canGoBack,
  onBack,
  onSave,
}: {
  role: Choice | null
  initialName: string
  initialPhone: string
  canGoBack: boolean
  onBack: () => void
  onSave: (name: string, phone: string) => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [touched, setTouched] = useState(false)

  const { run, loading, error } = useMutation(
    (n: string, p: string) => onSave(n, p),
    { silent: true },
  )

  const trimmedName = name.trim()
  const nameOk = trimmedName.length > 0
  const phoneOk = isValidPhone(phone)
  const canSubmit = nameOk && phoneOk

  const whyPhone = useMemo(
    () =>
      role === 'owner'
        ? 'Students and our team reach you here.'
        : 'Libraries call you on this number.',
    [role],
  )

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        setTouched(true)
        if (canSubmit) void run(trimmedName, normalizePhone(phone))
      }}
    >
      <TextField
        label="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        required
        error={touched && !nameOk ? 'Enter your name.' : undefined}
      />

      <TextField
        label="Mobile number"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="98765 43210"
        hint={phoneOk ? `We'll show it as ${formatPhone(phone)}. ${whyPhone}` : whyPhone}
        error={touched && !phoneOk ? 'Enter a 10-digit Indian mobile number. You can paste +91 98765 43210.' : undefined}
      />

      {error && <p className="text-sm font-medium text-danger">{error.message}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" className="sm:flex-1" loading={loading} disabled={!canSubmit}>
          Finish setup
        </Button>
        {canGoBack && (
          <Button type="button" variant="ghost" onClick={onBack} disabled={loading}>
            Back
          </Button>
        )}
      </div>
    </form>
  )
}
