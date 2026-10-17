import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { DevPanel } from '@/components/DevPanel'
import { AdminLayout } from '@/components/layouts/AdminLayout'
import { OwnerLayout } from '@/components/layouts/OwnerLayout'
import { PublicLayout } from '@/components/layouts/PublicLayout'
import { LoadingState } from '@/components/states/LoadingState'
import { ToastProvider } from '@/components/Toast'
import { AuthProvider } from '@/hooks/useAuth'
import { dataMode } from '@/lib/container'
import { RequireRole, RequireSignedIn } from '@/lib/guards'

// Pages are lazy so the landing page doesn't download the owner and admin screens.
const Home = lazy(() => import('@/pages/Home'))
const Login = lazy(() => import('@/pages/Login'))
const ChooseRole = lazy(() => import('@/pages/ChooseRole'))
const Discover = lazy(() => import('@/pages/Discover'))
const LibraryDetail = lazy(() => import('@/pages/LibraryDetail'))
const Privacy = lazy(() => import('@/pages/legal/Privacy'))
const Terms = lazy(() => import('@/pages/legal/Terms'))
const Refund = lazy(() => import('@/pages/legal/Refund'))
const MyRequests = lazy(() => import('@/pages/student/MyRequests'))
const MyMembership = lazy(() => import('@/pages/student/MyMembership'))
const NotFound = lazy(() => import('@/pages/NotFound'))
const Profile = lazy(() => import('@/pages/Profile'))

const OwnerDashboard = lazy(() => import('@/pages/owner/Dashboard'))
const OwnerSeats = lazy(() => import('@/pages/owner/Seats'))
const OwnerStudents = lazy(() => import('@/pages/owner/Students'))
const OwnerRequests = lazy(() => import('@/pages/owner/Requests'))
const OwnerPlan = lazy(() => import('@/pages/owner/Plan'))
const OwnerLibraryProfile = lazy(() => import('@/pages/owner/LibraryProfile'))

const AdminLibraries = lazy(() => import('@/pages/admin/Libraries'))
const AdminPayments = lazy(() => import('@/pages/admin/Payments'))
const AdminPlaces = lazy(() => import('@/pages/admin/Places'))

// `import.meta.env.DEV` is a build-time constant, so the styleguide is dropped from production builds.
const Styleguide = import.meta.env.DEV ? lazy(() => import('@/pages/dev/Styleguide')) : null

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense
            fallback={
              <div className="mx-auto max-w-3xl p-6">
                <LoadingState />
              </div>
            }
          >
            <Routes>
              <Route element={<PublicLayout />}>
                <Route index element={<Home />} />
                <Route path="login" element={<Login />} />
                <Route path="discover" element={<Discover />} />
                <Route path="library/:id" element={<LibraryDetail />} />
                <Route path="privacy" element={<Privacy />} />
                <Route path="terms" element={<Terms />} />
                <Route path="refund" element={<Refund />} />

                <Route element={<RequireSignedIn />}>
                  <Route path="choose-role" element={<ChooseRole />} />
                  <Route path="profile" element={<Profile />} />
                </Route>

                <Route element={<RequireRole roles={['student']} />}>
                  <Route path="student/requests" element={<MyRequests />} />
                  <Route path="student/membership" element={<MyMembership />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Route>

              <Route element={<RequireRole roles={['owner']} />}>
                <Route element={<OwnerLayout />}>
                  <Route path="owner" element={<OwnerDashboard />} />
                  <Route path="owner/seats" element={<OwnerSeats />} />
                  <Route path="owner/students" element={<OwnerStudents />} />
                  <Route path="owner/requests" element={<OwnerRequests />} />
                  <Route path="owner/plan" element={<OwnerPlan />} />
                  <Route path="owner/library" element={<OwnerLibraryProfile />} />
                </Route>
              </Route>

              <Route element={<RequireRole roles={['admin']} />}>
                <Route element={<AdminLayout />}>
                  <Route path="admin" element={<AdminLibraries />} />
                  <Route path="admin/payments" element={<AdminPayments />} />
                  <Route path="admin/places" element={<AdminPlaces />} />
                </Route>
              </Route>

              {Styleguide && <Route path="dev/styleguide" element={<Styleguide />} />}
            </Routes>
          </Suspense>
          {dataMode === 'mock' && <DevPanel />}
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
