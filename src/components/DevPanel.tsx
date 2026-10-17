import { useId, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FlaskConical, RotateCcw, X } from 'lucide-react'
import { formatDate, todayIST } from '@/domain/dates'
import type { Profile } from '@/domain/types'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { demoLogin } from '@/lib/container'
import { clockStore, devFlags, getNow, setClockOffsetDays, useNow } from '@/lib/devState'
import { useStore } from '@/lib/store'
import { resetMockData } from '@/repositories/mock/db'

/**
 * Dummy-mode control panel: switch user/role, move the clock (test trial expiry and renewals),
 * force loading/error states, and reset the data. Only rendered in mock mode.
 */
export function DevPanel() {
  const [open, setOpen] = useState(false)
  const { user, signInAs, signOut } = useAuth()
  const navigate = useNavigate()
  const now = useNow()
  const { offsetDays } = useStore(clockStore)
  const flags = useStore(devFlags)
  const accounts = useAsync(() => (demoLogin ? demoLogin.listAccounts() : Promise.resolve([] as Profile[])), [])
  const accountId = useId()
  const latencyId = useId()

  const shift = (d: number) => setClockOffsetDays(offsetDays + d)

  async function switchTo(id: string) {
    if (!id) {
      await signOut()
      navigate('/')
      return
    }
    const u = await signInAs(id)
    navigate(homePathFor(u))
  }

  return (
    <>
      {/* A slim bar in the normal page flow, so it never covers content. */}
      <div className="flex min-h-9 items-center gap-3 bg-ink px-4 py-1 text-sm text-white">
        <FlaskConical aria-hidden className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 truncate">
          <span className="font-medium">Demo mode</span>
          <span className="hidden text-white/70 sm:inline"> · sample data saved in this browser</span>
          {offsetDays !== 0 && <span className="text-white/70"> · date moved {offsetDays > 0 ? '+' : ''}{offsetDays} days</span>}
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="-my-1 min-h-11 shrink-0 cursor-pointer rounded-control px-3 font-semibold underline underline-offset-2 hover:bg-white/10"
        >
          Demo controls
        </button>
      </div>
      {open && (
        <section
          aria-label="Demo controls"
          className="fixed right-3 top-12 z-50 max-h-[calc(100dvh-4rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-y-auto rounded-card border border-border-strong bg-surface p-4 text-sm text-ink shadow-xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Demo controls</h2>
            <button
              type="button"
              aria-label="Close demo controls"
              onClick={() => setOpen(false)}
              className="-m-2 cursor-pointer rounded p-2 text-ink-muted hover:text-ink"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>

          <label htmlFor={accountId} className="mb-1 block font-medium">
            Signed in as
          </label>
          <select
            id={accountId}
            value={user?.id ?? ''}
            onChange={(e) => void switchTo(e.target.value)}
            className="mb-4 min-h-11 w-full cursor-pointer rounded-control border border-border-strong bg-surface px-3"
          >
            <option value="">Signed out</option>
            {(accounts.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.role ?? 'new'})
              </option>
            ))}
          </select>

          <p className="mb-1 font-medium">Today in the app</p>
          <p className="mb-2 tabular-nums text-ink-muted">
            {formatDate(todayIST(now))}
            {offsetDays !== 0 && ` (${offsetDays > 0 ? '+' : ''}${offsetDays} days)`}
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            {[-7, -1, 1, 7, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => shift(d)}
                className="min-h-11 min-w-12 cursor-pointer rounded-control border border-border-strong px-3 font-medium tabular-nums hover:bg-canvas"
              >
                {d > 0 ? `+${d}` : d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setClockOffsetDays(0)}
              className="min-h-11 cursor-pointer rounded-control border border-border-strong px-3 font-medium hover:bg-canvas"
            >
              Reset
            </button>
          </div>

          <fieldset className="mb-4 space-y-2">
            <legend className="mb-1 font-medium">Simulate</legend>
            <label className="flex min-h-9 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={flags.forceLoading}
                onChange={(e) => devFlags.set((f) => ({ ...f, forceLoading: e.target.checked }))}
              />
              Stuck loading
            </label>
            <label className="flex min-h-9 cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={flags.forceError}
                onChange={(e) => devFlags.set((f) => ({ ...f, forceError: e.target.checked }))}
              />
              Network errors
            </label>
            <div className="flex items-center gap-2">
              <label htmlFor={latencyId}>Delay</label>
              <select
                id={latencyId}
                value={flags.latencyMs}
                onChange={(e) => devFlags.set((f) => ({ ...f, latencyMs: Number(e.target.value) }))}
                className="min-h-11 cursor-pointer rounded-control border border-border-strong bg-surface px-2"
              >
                <option value={0}>None</option>
                <option value={250}>250 ms</option>
                <option value={1000}>1 second</option>
                <option value={3000}>3 seconds</option>
              </select>
            </div>
          </fieldset>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset all demo data to the starting set?')) {
                setClockOffsetDays(0)
                resetMockData()
                navigate('/')
              }
            }}
            className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-danger font-medium text-danger hover:bg-danger-soft"
          >
            <RotateCcw aria-hidden className="size-4" /> Reset demo data
          </button>
          <p className="mt-2 text-xs text-ink-muted">
            Saved in this browser only. Real time: {formatDate(todayIST(new Date()))}; app time:{' '}
            {formatDate(todayIST(getNow()))}.
          </p>
        </section>
      )}
    </>
  )
}
