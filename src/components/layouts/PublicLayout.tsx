import { dataMode } from '@/lib/container'
import { Suspense, useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ClipboardList, IdCard, Search } from 'lucide-react'
import { buttonStyles } from '@/components/Button'
import { Logo } from '@/components/Logo'
import { PageFallback } from '@/components/PageFallback'
import { UpdatesBanner } from '@/components/UpdatesBanner'
import { BottomTabs, type NavItemDef } from '@/components/layouts/Nav'
import { homePathFor, useAuth } from '@/hooks/useAuth'
import { cx } from '@/lib/cx'
import { BRAND } from '@/lib/brand'

const studentTabs: NavItemDef[] = [
  { to: '/discover', label: 'Find', icon: <Search /> },
  { to: '/student/requests', label: 'Requests', icon: <ClipboardList /> },
  { to: '/student/membership', label: 'Membership', icon: <IdCard /> },
]

function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' })
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])
  return null
}

const topLink = ({ isActive }: { isActive: boolean }) =>
  cx(
    'inline-flex min-h-11 pointer-fine:min-h-9 items-center rounded-control px-3 py-2 text-base pointer-fine:text-sm font-medium transition-colors',
    isActive ? 'text-primary' : 'text-ink-muted hover:text-ink',
  )

/** Header + footer for the public site and the student area. */
export function PublicLayout() {
  const { user, signOut } = useAuth()
  const isStudent = user?.role === 'student'

  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollManager />
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-border bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 sm:gap-x-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="ml-4 hidden items-center gap-1 md:flex">
            <NavLink to="/discover" className={topLink}>
              Find a library
            </NavLink>
            {isStudent && (
              <>
                <NavLink to="/student/requests" className={topLink}>
                  My requests
                </NavLink>
                <NavLink to="/student/membership" className={topLink}>
                  My membership
                </NavLink>
              </>
            )}
            {!user && (
              <Link to="/#owners" className={topLink({ isActive: false })}>
                For owners
              </Link>
            )}
          </nav>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {user ? (
              <>
                {!isStudent && (
                  <Link to={homePathFor(user)} className={buttonStyles('secondary')}>
                    {user.role === null ? 'Finish setting up' : 'Open dashboard'}
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className={buttonStyles('ghost', 'hidden sm:inline-flex')}
                >
                  Log out
                </button>
                {isStudent && (
                  <button type="button" onClick={() => void signOut()} className={buttonStyles('ghost', 'sm:hidden')}>
                    Log out
                  </button>
                )}
              </>
            ) : (
              <>
                <Link to="/login" className={buttonStyles('ghost', 'whitespace-nowrap px-2.5 sm:px-3 max-[359px]:hidden')}>
                  Log in
                </Link>
                <Link to="/login?as=owner" className={buttonStyles('primary', 'whitespace-nowrap px-2.5 sm:px-4')}>
                  <span className="sm:hidden">List library</span>
                  <span className="hidden sm:inline">List your library</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        {isStudent && <UpdatesBanner className="mx-auto max-w-6xl px-4 pt-6 sm:px-6" />}
        <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><PageFallback /></div>}>
          <Outlet />
        </Suspense>
      </main>

      <footer className={cx('border-t border-border bg-surface', isStudent && 'pb-20 md:pb-0')}>
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm text-ink-muted">
              Find a study library with a free seat, or run yours without paper registers.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <Link to="/discover" className="inline-flex min-h-11 pointer-fine:min-h-6 items-center text-ink-muted hover:text-ink">Find a library</Link>
            <Link to="/login?as=owner" className="inline-flex min-h-11 pointer-fine:min-h-6 items-center text-ink-muted hover:text-ink">List your library</Link>
            <Link to="/privacy" className="inline-flex min-h-11 pointer-fine:min-h-6 items-center text-ink-muted hover:text-ink">Privacy</Link>
            <Link to="/terms" className="inline-flex min-h-11 pointer-fine:min-h-6 items-center text-ink-muted hover:text-ink">Terms</Link>
            <Link to="/refund" className="inline-flex min-h-11 pointer-fine:min-h-6 items-center text-ink-muted hover:text-ink">Refunds</Link>
          </nav>
        </div>
        <p className="border-t border-border px-4 py-4 text-center text-sm text-ink-muted">
          © {new Date().getFullYear()} {BRAND.name}.{dataMode === 'mock' && ' Demo data only.'}
        </p>
      </footer>

      {isStudent && <BottomTabs items={studentTabs} />}
    </div>
  )
}
