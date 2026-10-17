import { useState, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { EmptyState } from '@/components/states/EmptyState'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { NotFoundState } from '@/components/states/NotFoundState'
import { SetupState } from '@/components/states/SetupState'

/** Dev-only visual test page. Every component in every state lives here. */

const swatches: { name: string; cls: string; note?: string }[] = [
  { name: 'canvas', cls: 'bg-canvas border border-border' },
  { name: 'surface', cls: 'bg-surface border border-border' },
  { name: 'border', cls: 'bg-border' },
  { name: 'border-strong', cls: 'bg-border-strong' },
  { name: 'ink', cls: 'bg-ink' },
  { name: 'ink-muted', cls: 'bg-ink-muted' },
  { name: 'primary', cls: 'bg-primary' },
  { name: 'primary-hover', cls: 'bg-primary-hover' },
  { name: 'primary-soft', cls: 'bg-primary-soft border border-border' },
  { name: 'accent', cls: 'bg-accent' },
  { name: 'accent-soft', cls: 'bg-accent-soft border border-border' },
  { name: 'success', cls: 'bg-success' },
  { name: 'warning', cls: 'bg-warning' },
  { name: 'danger', cls: 'bg-danger' },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure className="rounded-card border border-border bg-surface">
      <figcaption className="border-b border-border px-4 py-2 text-sm text-ink-muted">
        {label}
      </figcaption>
      {children}
    </figure>
  )
}

export default function Styleguide() {
  const [retrying, setRetrying] = useState(false)

  function fakeRetry() {
    setRetrying(true)
    window.setTimeout(() => setRetrying(false), 1500)
  }

  return (
    <main className="mx-auto max-w-4xl space-y-12 px-4 py-10 sm:px-6">
      <header>
        <h1 className="text-3xl font-semibold">Styleguide</h1>
        <p className="mt-1 text-ink-muted">Development only. Not included in production builds.</p>
      </header>

      <Section title="Colour tokens">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {swatches.map((s) => (
            <li key={s.name}>
              <div className={`h-12 rounded-control ${s.cls}`} />
              <p className="mt-1 text-sm">{s.name}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Type and tabular figures">
        <div className="space-y-1">
          <p className="text-3xl font-semibold">Find a seat close to home</p>
          <p className="text-xl font-semibold">Seat 12 is free</p>
          <p>Body text at 16px. Fees, dates and seat counts should line up in columns.</p>
          <p className="text-sm text-ink-muted">Secondary text, 14px, 7:1 on the page background.</p>
        </div>
        <div className="grid max-w-md grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-sm text-ink-muted">Proportional (default)</p>
            <p className="text-2xl font-semibold">
              1111
              <br />
              8888
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm text-ink-muted">tabular-nums</p>
            <p className="text-2xl font-semibold tabular-nums">
              1111
              <br />
              8888
            </p>
          </div>
        </div>
        <p className="tabular-nums">Plan fee ₹199 · Expires 24 Nov 2026 · 18 free, 22 occupied</p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap gap-3">
          <Button>Save changes</Button>
          <Button variant="secondary">Cancel</Button>
          <Button variant="accent">Activate plan</Button>
          <Button variant="danger">Remove student</Button>
          <Button variant="ghost">View details</Button>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="States">
        <div className="grid gap-6 md:grid-cols-2">
          <Frame label="LoadingState (list)">
            <div className="p-4">
              <LoadingState label="Loading students" count={3} />
            </div>
          </Frame>
          <Frame label="LoadingState (cards)">
            <div className="p-4">
              <LoadingState layout="cards" count={2} label="Loading libraries" />
            </div>
          </Frame>
          <Frame label="EmptyState">
            <EmptyState
              title="No students yet"
              description="Add your first student to start tracking seats and fees."
              action={<Button>Add student</Button>}
            />
          </Frame>
          <Frame label="SetupState">
            <SetupState action={<Button>Add library details</Button>} />
          </Frame>
          <Frame label="ErrorState">
            <ErrorState onRetry={fakeRetry} retrying={retrying} />
          </Frame>
          <Frame label="NotFoundState">
            <NotFoundState action={<Button variant="secondary">Back to search</Button>} />
          </Frame>
        </div>
      </Section>
    </main>
  )
}
