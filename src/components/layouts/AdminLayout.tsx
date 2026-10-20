import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Building2, LogOut, MapPin, Wallet } from 'lucide-react'
import { Button } from '@/components/Button'
import { Logo } from '@/components/Logo'
import { PageFallback } from '@/components/PageFallback'
import { BottomTabs, SidebarNav, type NavItemDef } from '@/components/layouts/Nav'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/hooks/useAuth'
import { services } from '@/lib/container'

export function AdminLayout() {
  const { user, signOut } = useAuth()
  // The menu badges only need two numbers, so ask for counts instead of downloading the full lists.
  const libs = useAsync(() => services.countPendingLibraries(), [])
  const pays = useAsync(() => services.countPendingPlanPayments(), [])

  const pendingLibs = libs.data ?? 0
  const pendingPays = pays.data ?? 0

  const items: NavItemDef[] = [
    { to: '/admin', label: 'Libraries', icon: <Building2 />, end: true, badge: pendingLibs },
    { to: '/admin/payments', label: 'Payments', icon: <Wallet />, badge: pendingPays },
    { to: '/admin/places', label: 'Cities', icon: <MapPin /> },
  ]

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface p-4 md:flex">
        <Logo to="/admin" className="mb-1 px-2" />
        <p className="mb-6 px-2 text-sm text-ink-muted">Admin</p>
        <SidebarNav items={items} />
        <div className="mt-auto border-t border-border pt-4">
          <p className="truncate px-2 text-sm font-medium">{user?.name}</p>
          <Button variant="ghost" className="mt-2 w-full justify-start" onClick={() => void signOut()}>
            <LogOut aria-hidden className="size-4" /> Log out
          </Button>
        </div>
      </aside>

      <div className="min-w-0 pb-24 md:pb-10">
        <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-x-3 border-b border-border bg-canvas/90 px-4 backdrop-blur md:hidden">
          <Logo to="/admin" />
          <span className="text-sm text-ink-muted">Admin</span>
          <Link to="/" className="ml-auto inline-flex min-h-11 pointer-fine:min-h-9 items-center text-sm text-ink-muted underline">
            Public site
          </Link>
          <button
            type="button"
            aria-label="Log out"
            onClick={() => void signOut()}
            className="flex size-11 cursor-pointer items-center justify-center rounded-control text-ink-muted hover:bg-surface"
          >
            <LogOut aria-hidden className="size-5" />
          </button>
        </header>
        <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8">
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      <BottomTabs items={items} />
    </div>
  )
}
