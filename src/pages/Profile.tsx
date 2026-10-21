import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, LogOut, Mail } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { TextField } from '@/components/Fields'
import { PageHeader } from '@/components/PageParts'
import { LoadingState } from '@/components/states/LoadingState'
import { formatPhone, isValidPhone, normalizePhone } from '@/domain/constants'
import { getSupportEmail } from '@/lib/env'
import type { Role } from '@/domain/types'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { useMutation } from '@/hooks/useMutation'
import { useTitle } from '@/hooks/useTitle'

const ROLE_LABEL: Record<Role, { label: string; tone: BadgeTone }> = {
  student: { label: 'Student', tone: 'primary' },
  owner: { label: 'Owner', tone: 'primary' },
  admin: { label: 'Admin', tone: 'accent' },
}

const SUPPORT_EMAIL = getSupportEmail()

export default function Profile() {
  useTitle('Your account')
  const navigate = useNavigate()
  const { user, loading, updateProfile, signOut } = useAuth()

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <LoadingState label="Loading your account" />
      </div>
    )
  }

  if (!user) {
    // Guards normally prevent this; render nothing rather than a broken form.
    return null
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <Link
        to={homePathFor(user)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-control text-sm font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Back to home
      </Link>

      <div className="mt-4">
        <PageHeader title="Your account" description="Your details and sign-in." />
      </div>

      <AccountForm
        key={user.id}
        initialName={user.name}
        email={user.email}
        initialPhone={user.phone}
        role={user.role}
        onSave={updateProfile}
      />

      <AccountCard
        onLogOut={async () => {
          await signOut()
          navigate('/', { replace: true })
        }}
      />
    </div>
  )
}

function AccountForm({
  initialName,
  email,
  initialPhone,
  role,
  onSave,
}: {
  initialName: string
  email: string
  initialPhone: string
  role: Role | null
  onSave: (patch: { name: string; phone: string }) => Promise<unknown>
}) {
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [touched, setTouched] = useState(false)

  const { run, loading } = useMutation(
    (patch: { name: string; phone: string }) => onSave(patch),
    { success: 'Changes saved' },
  )

  const trimmedName = name.trim()
  const nameOk = trimmedName.length > 0
  const phoneOk = isValidPhone(phone)
  const canSave = nameOk && phoneOk
  const roleInfo = role ? ROLE_LABEL[role] : null

  return (
    <Card className="mt-6 p-5 sm:p-6">
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          setTouched(true)
          if (canSave) void run({ name: trimmedName, phone: normalizePhone(phone) })
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
          label="Email"
          type="email"
          value={email}
          readOnly
          disabled
          hint="Your email comes from Google and can't be changed here."
        />

        <TextField
          label="Mobile number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="98765 43210"
          hint={
            phoneOk
              ? `Saved as ${formatPhone(phone)}`
              : 'Indian mobile number. You can paste +91 98765 43210.'
          }
          error={touched && !phoneOk ? 'Enter a 10-digit Indian mobile number.' : undefined}
        />

        {roleInfo && (
          <div>
            <p className="mb-1.5 text-sm font-medium">Role</p>
            <Badge tone={roleInfo.tone}>{roleInfo.label}</Badge>
            <p className="mt-1.5 text-sm text-ink-muted">
              Your role is permanent and can't be changed here.
            </p>
          </div>
        )}

        <Button type="submit" loading={loading} disabled={!canSave}>
          Save changes
        </Button>
      </form>
    </Card>
  )
}

function AccountCard({ onLogOut }: { onLogOut: () => Promise<void> }) {
  const { run, loading } = useMutation(() => onLogOut(), { silent: true })

  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">Account</h2>
      <Card className="mt-3 divide-y divide-border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <p className="font-medium text-ink">Log out</p>
            <p className="mt-0.5 text-sm text-ink-muted">Sign out of NearMe Library on this device.</p>
          </div>
          <Button variant="secondary" loading={loading} onClick={() => void run()}>
            <LogOut aria-hidden className="size-4" />
            Log out
          </Button>
        </div>

        <div className="p-5">
          <p className="font-medium text-ink">Delete my account</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            Account deletion isn't self-service yet. Email us from your account address and we'll
            handle it by hand. Some fee and membership records may be kept for accounting.
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my NearMe Library account')}`}
            className="mt-3 inline-flex min-h-11 max-w-full items-center gap-1.5 break-all rounded-control text-sm font-medium text-primary hover:text-primary-hover"
          >
            <Mail aria-hidden className="size-4" />
            Email {SUPPORT_EMAIL}
          </a>
        </div>
      </Card>
    </section>
  )
}
