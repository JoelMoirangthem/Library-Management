import { AppError } from '@/domain/errors'
import { isActive, planState, type PlanState } from '@/domain/plan'
import type { City, Library, Profile, Subscription } from '@/domain/types'
import { dataVersion, devFlags, getNow } from '@/lib/devState'
import { loadPlaces, placeData, type Town } from '@/repositories/mock/places'
import { createSeed, DB_VERSION, type DB } from '@/repositories/mock/seed'

/**
 * In-memory database saved to localStorage so refreshes keep your edits.
 * The mock repositories enforce the same rules the SQL functions and RLS will enforce.
 */
const STORAGE_KEY = 'studyseat.mock.db'

function load(): DB {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DB
      if (parsed.version === DB_VERSION) return parsed
    }
  } catch {
    /* corrupt or unavailable: fall through to a fresh seed */
  }
  return createSeed(new Date())
}

let db: DB = load()

export function getDb(): DB {
  return db
}

/** Persist and tell every mounted query to refetch. */
export function commit() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* quota or private mode: data lives for this session only */
  }
  dataVersion.set((v) => v + 1)
}

export function resetMockData() {
  db = createSeed(new Date())
  commit()
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

/** Applies simulated latency and the dev "force error" switch to every repository call. */
export async function run<T>(fn: () => T): Promise<T> {
  await loadPlaces()
  const { latencyMs, forceError } = devFlags.get()
  if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs))
  if (forceError) throw new AppError('network', 'Simulated network error (dev panel).')
  return structuredClone(fn())
}

// ---- places (official lists from places.generated.json, plus towns an admin added) ----

/** An official town or one an admin added. */
export function townById(id: string): Town | undefined {
  return placeData().townById.get(id) ?? db.addedCities.find((c) => c.id === id)
}

export function allTowns(): Town[] {
  return [...placeData().towns, ...db.addedCities]
}

export function isCityActive(id: string): boolean {
  return Boolean(townById(id)) && !db.inactiveCityIds.includes(id)
}

export function toCity(t: Town): City {
  return { id: t.id, stateId: t.stateId, name: t.name, isActive: !db.inactiveCityIds.includes(t.id) }
}

/** Names of a library's state, district, town and area (area empty when none). */
export function placeNames(p: { stateId: string; districtId: string; cityId: string; areaId: string | null }) {
  const places = placeData()
  return {
    stateName: places.stateById.get(p.stateId)?.name ?? '',
    districtName: places.districtById.get(p.districtId)?.name ?? '',
    cityName: townById(p.cityId)?.name ?? '',
    areaName: (p.areaId && db.areas.find((a) => a.id === p.areaId)?.name) || '',
  }
}

// ---- session ----

export function currentUser(): Profile | null {
  return db.profiles.find((p) => p.id === db.sessionUserId) ?? null
}

export function requireUser(): Profile {
  const u = currentUser()
  if (!u) throw new AppError('forbidden', 'Sign in to continue.')
  return u
}

export function requireRole(role: Profile['role']): Profile {
  const u = requireUser()
  if (u.role !== role) throw new AppError('forbidden', 'You do not have access to this.')
  return u
}

// ---- rule helpers (mirror is_library_active / is_library_owner) ----

export function findLibrary(id: string): Library {
  const lib = db.libraries.find((l) => l.id === id)
  if (!lib) throw new AppError('not_found', 'Library not found.')
  return lib
}

export function subscriptionOf(libraryId: string): Subscription | null {
  return db.subscriptions.find((s) => s.libraryId === libraryId) ?? null
}

export function stateOf(library: Library): PlanState {
  return planState(library, subscriptionOf(library.id), getNow())
}

export function isLibraryActive(library: Library): boolean {
  return isActive(stateOf(library))
}

/** The caller must own the library. */
export function requireOwner(libraryId: string): Library {
  const user = requireRole('owner')
  const lib = findLibrary(libraryId)
  if (lib.ownerId !== user.id) throw new AppError('forbidden', 'This is not your library.')
  return lib
}

/** Owner of an *active* library: the rule behind every write except plan payments (BR-6). */
export function requireActiveOwner(libraryId: string): Library {
  const lib = requireOwner(libraryId)
  if (!isLibraryActive(lib)) {
    throw new AppError('forbidden', 'Your plan has expired. Renew to make changes.')
  }
  return lib
}

export function activeSeats(libraryId: string) {
  return getDb().seats.filter((s) => s.libraryId === libraryId && s.isActive)
}

/** Seats not held by an active member IN THIS SHIFT. The same seat can be free in one shift and taken in another. */
export function seatsLeftInShift(libraryId: string, shiftId: string): { total: number; left: number } {
  const db = getDb()
  const active = activeSeats(libraryId)
  const taken = new Set(
    db.members
      .filter((m) => m.libraryId === libraryId && m.shiftId === shiftId && m.status === 'active' && m.seatId)
      .map((m) => m.seatId),
  )
  return { total: active.length, left: active.filter((s) => !taken.has(s.id)).length }
}

export function shiftsOf(libraryId: string) {
  return getDb().shifts.filter((s) => s.libraryId === libraryId)
}
export function createSeats(libraryId: string, from: number, to: number) {
  for (let n = from; n <= to; n++) {
    db.seats.push({ id: `${libraryId}_s${n}`, libraryId, seatNumber: n, isActive: true })
  }
}
