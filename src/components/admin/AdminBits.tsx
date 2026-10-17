import { useId, useState, type ReactNode } from 'react'
import { Check, Copy, Phone } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { useToast } from '@/components/Toast'
import { cx } from '@/lib/cx'
import { formatPhone } from '@/domain/constants'
import { formatDateTime } from '@/domain/dates'

/** A 44px tel link that shows the number with formatPhone and a leading phone icon. */
export function TelLink({
  phone,
  className,
}: {
  phone: string
  className?: string
}) {
  return (
    <a
      href={`tel:${phone}`}
      className={cx(
        'inline-flex min-h-11 items-center gap-1.5 tabular-nums text-primary hover:underline',
        className,
      )}
    >
      <Phone aria-hidden className="size-4 shrink-0" />
      {formatPhone(phone)}
    </a>
  )
}

/**
 * Relative time like '3 hours ago' for the display text; the exact time goes in the title.
 * `now` is passed in so the fake clock works.
 */
function relativeTime(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime()
  const sec = Math.round(ms / 1000)
  const abs = Math.abs(sec)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ]
  for (const [unit, secs] of units) {
    if (abs >= secs) return rtf.format(-Math.round(sec / secs), unit)
  }
  return rtf.format(-sec, 'second')
}

/** Relative time as text with the exact time on hover/title. */
export function RelativeTime({ iso, now, prefix }: { iso: string; now: Date; prefix?: string }) {
  return (
    <span title={formatDateTime(iso)} className="tabular-nums">
      {prefix}
      {relativeTime(iso, now)}
    </span>
  )
}

/** A row of segmented filter buttons with counts. Real buttons with aria-pressed. */
export type SegOption<T extends string> = { value: T; label: string; count?: number }

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2 overflow-x-auto"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary-soft text-primary-ink'
                : 'border-border-strong bg-surface text-ink hover:bg-canvas',
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cx(
                  'rounded-full px-1.5 text-xs tabular-nums',
                  active ? 'bg-primary/15 text-primary-ink' : 'bg-canvas text-ink-muted',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Accessible on/off switch backed by a real checkbox, with a visible label. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: (on: boolean) => void
  label: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <label
      htmlFor={id}
      className={cx(
        'inline-flex cursor-pointer select-none items-center gap-2 text-sm font-medium',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <span className="relative inline-flex">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden
          className="h-6 w-10 rounded-full bg-border transition-colors peer-checked:bg-primary peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary"
        />
        <span
          aria-hidden
          className="absolute left-0.5 top-0.5 size-5 rounded-full bg-surface transition-transform peer-checked:translate-x-4"
        />
      </span>
      {label}
    </label>
  )
}

/** Copies text to the clipboard and shows a toast. */
export function CopyButton({ value, toastText }: { value: string; toastText: string }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={`Copy ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          toast.show(toastText, 'success')
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1500)
        } catch {
          toast.show("Couldn't copy. Select and copy it by hand.", 'error')
        }
      }}
      className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control border border-border-strong text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
    >
      {copied ? <Check aria-hidden className="size-4 text-success-ink" /> : <Copy aria-hidden className="size-4" />}
    </button>
  )
}

export type StatusView = { tone: BadgeTone; label: string }

export function PaymentStatusBadge({ status }: { status: 'pending' | 'verified' | 'failed' }) {
  const view: Record<typeof status, StatusView> = {
    pending: { tone: 'accent', label: 'Pending' },
    verified: { tone: 'success', label: 'Verified' },
    failed: { tone: 'danger', label: 'Failed' },
  }
  const v = view[status]
  return <Badge tone={v.tone}>{v.label}</Badge>
}

/** A small labelled key/value used in detail panels. */
export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5 sm:flex-row sm:gap-3">
      <dt className="w-32 shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  )
}
