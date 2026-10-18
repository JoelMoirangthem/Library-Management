import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { cx } from '@/lib/cx'

export type NavItemDef = {
  to: string
  label: string
  icon: ReactNode
  /** Match the path exactly (for index routes like /owner). */
  end?: boolean
  /** Count shown as a pill, e.g. pending requests. Hidden when 0. */
  badge?: number
}

function Badge({ n }: { n?: number }) {
  if (!n) return null
  return (
    <span
      aria-label={`${n} pending`}
      className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold tabular-nums text-white"
    >
      {n}
    </span>
  )
}

/** Desktop left rail. */
export function SidebarNav({ items }: { items: NavItemDef[] }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cx(
              'flex min-h-11 pointer-fine:min-h-9 items-center gap-3 rounded-control px-3 text-base pointer-fine:text-sm font-medium transition-colors',
              isActive ? 'bg-primary-soft text-primary-ink' : 'text-ink-muted hover:bg-canvas hover:text-ink',
            )
          }
        >
          <span aria-hidden className="[&>svg]:size-5">{it.icon}</span>
          {it.label}
          <Badge n={it.badge} />
        </NavLink>
      ))}
    </nav>
  )
}

/** Phone bottom tab bar. Keep to five items or fewer. */
export function BottomTabs({ items }: { items: NavItemDef[] }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((it) => (
          <li key={it.to}>
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cx(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium',
                  isActive ? 'text-primary' : 'text-ink-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden
                    className={cx(
                      'flex h-7 w-12 max-w-full items-center justify-center rounded-full transition-colors [&>svg]:size-5',
                      isActive && 'bg-primary-soft',
                    )}
                  >
                    {it.icon}
                  </span>
                  {it.label}
                  {!!it.badge && (
                    <span
                      aria-label={`${it.badge} pending`}
                      className="absolute right-[22%] top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold tabular-nums text-white"
                    >
                      {it.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
