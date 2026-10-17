import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cx } from '@/lib/cx'

export type StepState = 'done' | 'current' | 'todo'

/**
 * A real sequence (setup stages, payment progress), so numbering is justified.
 * Horizontal on wide screens, compact on phones. `aria-current="step"` marks the current one.
 */
export function Steps({
  steps,
  className,
}: {
  steps: { label: string; hint?: string; state: StepState }[]
  className?: string
}) {
  return (
    <ol className={cx('flex gap-2 sm:gap-4', className)}>
      {steps.map((s, i) => (
        <li
          key={s.label}
          aria-current={s.state === 'current' ? 'step' : undefined}
          className="flex min-w-0 flex-1 flex-col gap-2"
        >
          <span
            aria-hidden
            className={cx(
              'h-1.5 rounded-full',
              s.state === 'todo' ? 'bg-border' : 'bg-primary',
            )}
          />
          <span className="flex items-center gap-2">
            <span
              aria-hidden
              className={cx(
                'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums',
                s.state === 'done' && 'bg-primary text-white',
                s.state === 'current' && 'border-2 border-primary text-primary',
                s.state === 'todo' && 'border border-border-strong text-ink-muted',
              )}
            >
              {s.state === 'done' ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={cx('truncate text-sm font-medium', s.state === 'todo' && 'text-ink-muted')}>
              {s.label}
            </span>
          </span>
          {s.hint && <span className="hidden text-xs text-ink-muted sm:block">{s.hint}</span>}
          <span className="sr-only">
            {s.state === 'done' ? 'Done' : s.state === 'current' ? 'Current step' : 'Not started'}
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * The one celebratory beat after a meaningful action (request sent, library submitted).
 * The check draws itself once; with reduced motion it simply appears.
 */
export function SuccessMoment({
  title,
  children,
  actions,
  className,
}: {
  title: string
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div role="status" className={cx('flex flex-col items-center px-4 py-10 text-center', className)}>
      <svg viewBox="0 0 64 64" aria-hidden className="mb-5 size-20">
        <circle cx="32" cy="32" r="30" className="fill-success-soft stroke-success" strokeWidth="2" />
        <path
          d="M19 33 l9 9 l17-19"
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          className="stroke-success motion-safe:animate-[draw_0.5s_0.15s_ease-out_both]"
          strokeDasharray="1"
        />
      </svg>
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children && <div className="mt-2 max-w-md text-ink-muted">{children}</div>}
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  )
}
