import { MockPhotoRepository } from '@/repositories/mock/MockPhotoRepository'
import { createServices, type Repositories } from '@/services/createServices'
import type { DemoLogin } from '@/repositories/interfaces'
import {
  MockAuthRepository,
  MockCatalogRepository,
  MockDemoLogin,
  MockFeeRepository,
  MockLibraryRepository,
  MockMemberRepository,
  MockPlanPaymentRepository,
  MockSeatRepository,
  MockSeatRequestRepository,
  MockShiftRepository,
  MockSubscriptionRepository,
} from '@/repositories/mock/mockRepos'
import { SupabasePhotoRepository } from '@/repositories/supabase/SupabasePhotoRepository'
import { SupabaseAuthRepository } from '@/repositories/supabase/SupabaseAuthRepository'
import { SupabaseCatalogRepository } from '@/repositories/supabase/SupabaseCatalogRepository'
import { SupabaseLibraryRepository } from '@/repositories/supabase/SupabaseLibraryRepository'
import {
  SupabaseSeatRepository,
  SupabaseShiftRepository,
  SupabaseSubscriptionRepository,
} from '@/repositories/supabase/SupabaseShiftRepositories'
import { SupabaseFeeRepository, SupabaseMemberRepository } from '@/repositories/supabase/SupabaseMemberRepositories'
import {
  SupabasePlanPaymentRepository,
  SupabaseSeatRequestRepository,
} from '@/repositories/supabase/SupabaseOperationsRepositories'
import { getSupabase } from '@/lib/supabase'
import { dataVersion } from '@/lib/devState'
import { refreshAfterWrites } from '@/repositories/supabase/refreshAfterWrites'

/**
 * The one place that knows which repository implementations exist (Dependency Inversion).
 * Everything else imports `services` from here.
 *
 * VITE_DATA_MODE=mock (default) uses in-browser dummy data.
 * VITE_DATA_MODE=supabase uses the real database. Repositories that are not built yet are
 * `notConnected` stubs that fail loudly, so nothing quietly falls back to dummy data.
 */
export type DataMode = 'mock' | 'supabase'

export const dataMode: DataMode = import.meta.env.VITE_DATA_MODE === 'supabase' ? 'supabase' : 'mock'

function mockRepositories(): Repositories {
  return {
    auth: new MockAuthRepository(),
    catalog: new MockCatalogRepository(),
    libraries: new MockLibraryRepository(),
    subscriptions: new MockSubscriptionRepository(),
    shifts: new MockShiftRepository(),
    planPayments: new MockPlanPaymentRepository(),
    seats: new MockSeatRepository(),
    members: new MockMemberRepository(),
    fees: new MockFeeRepository(),
    seatRequests: new MockSeatRequestRepository(),
    photos: new MockPhotoRepository(),
  }
}

const bump = () => dataVersion.set((v) => v + 1)

function supabaseRepositories(): Repositories {
  const r = {
    auth: new SupabaseAuthRepository(),
    catalog: new SupabaseCatalogRepository(),
    libraries: new SupabaseLibraryRepository(),
    subscriptions: new SupabaseSubscriptionRepository(),
    shifts: new SupabaseShiftRepository(),
    planPayments: new SupabasePlanPaymentRepository(),
    seats: new SupabaseSeatRepository(),
    members: new SupabaseMemberRepository(),
    fees: new SupabaseFeeRepository(),
    seatRequests: new SupabaseSeatRequestRepository(),
    photos: new SupabasePhotoRepository(),
  }
  return {
    auth: refreshAfterWrites(r.auth, bump),
    catalog: refreshAfterWrites(r.catalog, bump),
    libraries: refreshAfterWrites(r.libraries, bump),
    subscriptions: refreshAfterWrites(r.subscriptions, bump),
    shifts: refreshAfterWrites(r.shifts, bump),
    planPayments: refreshAfterWrites(r.planPayments, bump),
    seats: refreshAfterWrites(r.seats, bump),
    members: refreshAfterWrites(r.members, bump),
    fees: refreshAfterWrites(r.fees, bump),
    seatRequests: refreshAfterWrites(r.seatRequests, bump),
    photos: r.photos, // uploads do not change any screen's data; the library save does
  }
}

export const services = createServices(dataMode === 'supabase' ? supabaseRepositories() : mockRepositories())

/** Only present in mock mode: stands in for "Continue with Google". */
export const demoLogin: DemoLogin | null = dataMode === 'mock' ? new MockDemoLogin() : null

// Real mode: when Supabase finishes sign-in (after the Google redirect), sign-out, or refreshes a
// token, tell every mounted query to reload so the screen matches the session.
if (dataMode === 'supabase') {
  getSupabase().auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
      // Deferred: supabase-js forbids calling its own methods inside this callback.
      setTimeout(() => dataVersion.set((v) => v + 1), 0)
    }
  })
}