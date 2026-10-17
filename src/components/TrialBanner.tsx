import { Link } from 'react-router-dom'
import { Clock, Hourglass, ShieldAlert, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { buttonStyles } from '@/components/Button'
import { useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { cx } from '@/lib/cx'

function Bar({
  tone,
  icon,
  children,
  action,
}: {
  tone: 'info' | 'warning' | 'danger'
  icon: ReactNode
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(
        'mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border px-4 py-3',
        tone === 'info' && 'border-primary/25 bg-primary-soft text-primary-ink',
        tone === 'warning' && 'border-warning/30 bg-warning-soft text-warning-ink',
        tone === 'danger' && 'border-danger/30 bg-danger-soft text-danger-ink',
      )}
    >
      <span aria-hidden className="[&>svg]:size-5">{icon}</span>
      <p className="min-w-0 flex-1 text-sm font-medium sm:text-base">{children}</p>
      {action}
    </div>
  )
}

/**
 * Shown at the top of every owner page. One message at a time, in order of urgency:
 * pending review, rejected, expired, trial ending, trial running, plan ending soon.
 */
export function TrialBanner() {
  const { state, daysLeft } = useOwnerLibrary()
  const dayWord = (n: number) => `${n} day${n === 1 ? '' : 's'}`

  switch (state) {
    case 'pending':
      return (
        <Bar tone="info" icon={<Hourglass />}>
          In review, usually within 24 hours. Your 14-day free trial starts when we approve it.
        </Bar>
      )
    case 'rejected':
      return (
        <Bar
          tone="danger"
          icon={<ShieldAlert />}
          action={
            <Link to="/owner/library" className={buttonStyles('secondary')}>
              Fix and resubmit
            </Link>
          }
        >
          Your library needs changes before it can go live.
        </Bar>
      )
    case 'expired':
      return (
        <Bar
          tone="danger"
          icon={<TriangleAlert />}
          action={
            <Link to="/owner/plan" className={buttonStyles('accent')}>
              Renew plan
            </Link>
          }
        >
          Your plan has expired. Students can no longer find your library, and this dashboard is read-only.
        </Bar>
      )
    case 'trial':
      return daysLeft <= 3 ? (
        <Bar
          tone="warning"
          icon={<Clock />}
          action={
            <Link to="/owner/plan" className={buttonStyles('accent')}>
              Activate plan
            </Link>
          }
        >
          Your free trial ends in {dayWord(daysLeft)}. Activate the plan to stay visible.
        </Bar>
      ) : (
        <Bar
          tone="info"
          icon={<Clock />}
          action={
            <Link to="/owner/plan" className={buttonStyles('ghost')}>
              See plan
            </Link>
          }
        >
          Free trial: {dayWord(daysLeft)} left.
        </Bar>
      )
    case 'paid':
      return daysLeft <= 5 ? (
        <Bar
          tone="warning"
          icon={<Clock />}
          action={
            <Link to="/owner/plan" className={buttonStyles('accent')}>
              Renew plan
            </Link>
          }
        >
          Your plan ends in {dayWord(daysLeft)}. Renew early and the days stack.
        </Bar>
      ) : null
    default:
      return null
  }
}
