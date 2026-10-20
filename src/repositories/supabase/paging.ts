import { AppError } from '@/domain/errors'
import { toAppErrorFromSupabase } from '@/repositories/supabase/errors'

/**
 * The Supabase API returns at most 1000 rows per request, however many you ask for: a request for rows 0 to 9999
 * quietly gives back 1000 (checked against this project). A list that grows without a bound (fees, members,
 * payments, profiles) must therefore be read page by page until a page comes back short.
 */
export const PAGE_SIZE = 1000

/** A safety stop so a runaway table cannot freeze the browser. Far above any realistic single library. */
export const MAX_TOTAL_ROWS = 20000

type Page<T> = { data: T[] | null; error: { code?: string; message?: string } | null }

/**
 * `page(from, to)` must run the SAME query with `.range(from, to)`. The query must have a UNIQUE sort order
 * (end it with `.order('id')`), otherwise rows can repeat or go missing between pages.
 */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw toAppErrorFromSupabase(error)
    const rows = data ?? []
    all.push(...rows)
    if (rows.length < PAGE_SIZE) return all
    if (all.length >= MAX_TOTAL_ROWS) throw new AppError('unknown', 'There are too many records to load at once. Please contact support.')
  }
}

/** Splits a list into groups of at most `size`, for `.in('id', group)` filters whose ids travel in the web address. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (!(size >= 1)) throw new Error('chunk size must be at least 1')
  const groups: T[][] = []
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size))
  return groups
}

/**
 * Looks up just the rows an on-screen list refers to (for example the owners of the libraries shown), instead of
 * downloading a whole table. Each id is asked for once, in groups of 100 so the web address stays short.
 * `load(group)` must run `.in('<column>', group)`; a group of 100 can never reach the 1000-row cap.
 */
export async function fetchByIds<T>(ids: string[], load: (group: string[]) => PromiseLike<Page<T>>): Promise<T[]> {
  const unique = [...new Set(ids.filter((id) => id))]
  const groups = await Promise.all(
    chunk(unique, 100).map(async (group) => {
      const { data, error } = await load(group)
      if (error) throw toAppErrorFromSupabase(error)
      return data ?? []
    }),
  )
  return groups.flat()
}
