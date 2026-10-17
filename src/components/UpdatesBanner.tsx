import { Link } from 'react-router-dom'
import { CircleCheck, TriangleAlert, X } from 'lucide-react'
import { useUpdates } from '@/hooks/useUpdates'
import { cx } from '@/lib/cx'

/** Dismissible cards for things that happened while the person was away. Renders nothing when there are none. */
export function UpdatesBanner({ className }: { className?: string }) {
  const { updates, dismiss } = useUpdates()
  if (updates.length === 0) return null

  return (
    <section aria-label="Updates" className={cx('space-y-3', className)}>
      {updates.slice(0, 3).map((u) => (
        <div
          key={u.id}
          role={u.tone === 'danger' ? 'alert' : 'status'}
          className={cx(
            'flex items-start gap-3 rounded-card border p-4',
            u.tone === 'success' && 'border-success/30 bg-success-soft text-success-ink',
            u.tone === 'danger' && 'border-danger/30 bg-danger-soft text-danger-ink',
            u.tone === 'info' && 'border-primary/25 bg-primary-soft text-primary-ink',
          )}
        >
          <span aria-hidden className="mt-0.5 [&>svg]:size-5">
            {u.tone === 'danger' ? <TriangleAlert /> : <CircleCheck />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{u.title}</p>
            <p className="mt-0.5 text-sm">{u.body}</p>
            <Link
              to={u.href}
              onClick={() => dismiss(u.id)}
              className="mt-2 inline-flex min-h-11 items-center font-semibold underline underline-offset-2"
            >
              {u.linkLabel}
            </Link>
          </div>
          <button
            type="button"
            onClick={() => dismiss(u.id)}
            aria-label={`Dismiss: ${u.title}`}
            className="-m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control hover:bg-black/5"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </section>
  )
}
