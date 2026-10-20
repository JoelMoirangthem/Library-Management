import { Suspense, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Armchair, Building2, ClipboardList, LayoutDashboard, LogOut, UserRound, Users, Wallet } from 'lucide-react'
import { Button } from '@/components/Button'
import { Logo } from '@/components/Logo'
import { BottomTabs, SidebarNav, type NavItemDef } from '@/components/layouts/Nav'
import { ErrorState } from '@/components/states/ErrorState'
import { LoadingState } from '@/components/states/LoadingState'
import { PageFallback } from '@/components/PageFallback'
import { TrialBanner } from '@/components/TrialBanner'
import { UpdatesBanner } from '@/components/UpdatesBanner'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { OwnerLibraryProvider, useOwnerLibrary } from '@/hooks/useOwnerLibrary'
import { services } from '@/lib/container'
import { Link } from 'react-router-dom'

function Shell() {
  const { user, signOut } = useAuth()
  const { library, state, loading, error, reload } = useOwnerLibrary()
  const { pathname } = useLocation()

  const approved = state === 'trial' || state === 'paid' || state === 'expired'
  const requests = useAsync(
    () => (library && approved ? services.listLibrarySeatRequests(library.id) : Promise.resolve([])),
    [library?.id, approved],
  )
  const pending = (requests.data ?? []).filter((r) => r.status === 'pending').length

  // Block the screen with a spinner only on the FIRST load. A later reload (after any save) must keep the page
  // mounted: swapping it for a spinner threw away the page's own state, e.g. the "Submitted for review" screen
  // right after a first-time listing, and every save of a library still in review.
  const [ready, setReady] = useState(false)
  if (!loading && !ready) setReady(true)

  if (loading && !ready) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <LoadingState label="Loading your library" />
      </div>
    )
  }
  if (error) return <ErrorState onRetry={reload} />

  // First-time owners go straight to the library form; unapproved ones only see Home + Library.
  if (state === 'none' && pathname !== '/owner/library') return <Navigate to="/owner/library" replace />
  if ((state === 'pending' || state === 'rejected') && pathname !== '/owner' && pathname !== '/owner/library') {
    return <Navigate to="/owner" replace />
  }

  const items: NavItemDef[] = [
    { to: '/owner', label: 'Home', icon: <LayoutDashboard />, end: true },
    { to: '/owner/seats', label: 'Seats', icon: <Armchair /> },
    { to: '/owner/students', label: 'Students', icon: <Users /> },
    { to: '/owner/requests', label: 'Requests', icon: <ClipboardList />, badge: pending },
    { to: '/owner/plan', label: 'Plan', icon: <Wallet /> },
  ]
  const sidebar: NavItemDef[] = [...items, { to: '/owner/library', label: 'Library profile', icon: <Building2 /> }]
  const onboarding = state === 'none'

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface p-4 md:flex">
        <Logo to="/owner" className="mb-6 px-2" />
        {!onboarding && <SidebarNav items={sidebar} />}
        <div className="mt-auto border-t border-border pt-4">
          <p className="truncate px-2 text-sm font-medium">{library?.name ?? user?.name}</p>
          <p className="truncate px-2 text-sm text-ink-muted">{user?.email}</p>
          <Link to="/profile" className="mt-2 flex min-h-11 pointer-fine:min-h-9 items-center gap-2 rounded-control px-4 text-base pointer-fine:text-sm font-medium text-primary hover:bg-primary-soft">
            <UserRound aria-hidden className="size-4" /> Account
          </Link>
          <Button variant="ghost" className="w-full justify-start" onClick={() => void signOut()}>
            <LogOut aria-hidden className="size-4" /> Log out
          </Button>
        </div>
      </aside>

      <div className="min-w-0 pb-24 md:pb-10">
        {/* Phone top bar */}
        <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-x-3 border-b border-border bg-canvas/90 px-4 backdrop-blur md:hidden">
          <Logo to="/owner" />
          <div className="ml-auto flex items-center gap-1">
            {!onboarding && (
              <Link
                to="/owner/library"
                aria-label="Library profile"
                className="flex size-11 items-center justify-center rounded-control text-ink-muted hover:bg-surface"
              >
                <Building2 aria-hidden className="size-5" />
              </Link>
            )}
            <button
              type="button"
              aria-label="Log out"
              onClick={() => void signOut()}
              className="flex size-11 cursor-pointer items-center justify-center rounded-control text-ink-muted hover:bg-surface"
            >
              <LogOut aria-hidden className="size-5" />
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8">
          <UpdatesBanner className="mb-6" />
          <TrialBanner />
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {!onboarding && <BottomTabs items={items} />}
    </div>
  )
}

export function OwnerLayout() {
  return (
    <OwnerLibraryProvider>
      <Shell />
    </OwnerLibraryProvider>
  )
}
