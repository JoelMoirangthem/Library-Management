import { Link } from 'react-router-dom'
import { cx } from '@/lib/cx'
import { BRAND } from '@/lib/brand'

/**
 * The brand mark: a map pin ("near me") with a tiny seat grid inside. Three seats are taken, one is free (light orange).
 * public/favicon.svg draws the same mark, so the tab icon and the logo always match.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cx('size-7', className)}>
      <path className="fill-primary" d="M12 22.5C12 22.5 4 15.2 4 9.6a8 8 0 0 1 16 0c0 5.6-8 12.9-8 12.9Z" />
      <rect x="8.2" y="5.8" width="3.3" height="3.3" rx=".9" fill="#fff" />
      <rect x="12.5" y="5.8" width="3.3" height="3.3" rx=".9" fill="#fff" />
      <rect x="8.2" y="10.1" width="3.3" height="3.3" rx=".9" fill="#fff" />
      <rect x="12.5" y="10.1" width="3.3" height="3.3" rx=".9" fill="#FDBA74" />
    </svg>
  )
}

export function Logo({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link
      to={to}
      aria-label={`${BRAND.name} home`}
      className={cx('inline-flex min-h-11 items-center gap-2 rounded-control text-lg font-semibold tracking-tight', className)}
    >
      <LogoMark />
      {BRAND.name}
    </Link>
  )
}