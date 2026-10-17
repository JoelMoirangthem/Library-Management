import { createServices } from '@/services/createServices'
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

/**
 * The one place that knows which repository implementations exist (Dependency Inversion).
 * Everything else imports `services` from here.
 *
 * VITE_DATA_MODE=mock (default) uses in-browser dummy data. The Supabase implementations
 * will live in src/repositories/supabase and plug in here without touching services or pages.
 */
export type DataMode = 'mock' | 'supabase'

export const dataMode: DataMode = import.meta.env.VITE_DATA_MODE === 'supabase' ? 'supabase' : 'mock'

if (dataMode === 'supabase') {
  throw new Error('Supabase data mode is not built yet. Set VITE_DATA_MODE=mock (or remove it).')
}

export const services = createServices({
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
})

/** Only present in mock mode: stands in for "Continue with Google". */
export const demoLogin: DemoLogin | null = new MockDemoLogin()
