import { AppError } from '@/domain/errors'

/**
 * Stands in for a repository that has not been connected to Supabase yet. Any call fails with a
 * clear sentence instead of silently returning dummy data, so mixed-mode mistakes are obvious.
 * Each real repository replaces one of these as it is built.
 */
export function notConnected<T extends object>(name: string): T {
  return new Proxy({} as T, {
    get(_target, prop) {
      if (prop === 'then') return undefined // so `await repo` never treats this as a promise
      return () =>
        Promise.reject(
          new AppError('unknown', `${name} is not connected to the real database yet (${String(prop)}).`),
        )
    },
  })
}
