import { describe, expect, it } from 'vitest'
import { AppError } from '@/domain/errors'
import { chunk, fetchAll, MAX_TOTAL_ROWS, PAGE_SIZE } from '@/repositories/supabase/paging'

/** A fake table of `total` rows that, like the real API, never returns more than `cap` rows per request. */
function fakeTable(total: number, cap = PAGE_SIZE) {
  const calls: Array<[number, number]> = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    const end = Math.min(to, from + cap - 1, total - 1)
    const data = from > end ? [] : Array.from({ length: end - from + 1 }, (_, i) => ({ id: from + i }))
    return { data, error: null }
  }
  return { page, calls }
}

describe('fetchAll (the API returns at most 1000 rows per request, so lists must be fetched page by page)', () => {
  it('returns a short list in one request', async () => {
    const t = fakeTable(37)
    const rows = await fetchAll(t.page)
    expect(rows).toHaveLength(37)
    expect(t.calls).toEqual([[0, PAGE_SIZE - 1]])
  })

  it('returns an empty list in one request', async () => {
    const t = fakeTable(0)
    expect(await fetchAll(t.page)).toEqual([])
    expect(t.calls).toHaveLength(1)
  })

  it('keeps going past 1000 rows and returns every row once, in order', async () => {
    const t = fakeTable(2500)
    const rows = await fetchAll(t.page)
    expect(rows).toHaveLength(2500)
    expect(rows.map((r) => r.id)).toEqual(Array.from({ length: 2500 }, (_, i) => i))
    expect(t.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('handles a table of exactly one full page', async () => {
    const t = fakeTable(PAGE_SIZE)
    const rows = await fetchAll(t.page)
    expect(rows).toHaveLength(PAGE_SIZE)
    expect(t.calls).toHaveLength(2) // the second request is empty and proves there is nothing more
  })

  it('turns a database error on any page into an app error, never a partial list', async () => {
    let n = 0
    const page = async () => (++n === 2 ? { data: null, error: { code: '42501', message: 'nope' } } : { data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ id: i })), error: null })
    await expect(fetchAll(page)).rejects.toBeInstanceOf(AppError)
  })

  it('refuses to load an absurd number of rows instead of freezing the browser', async () => {
    const t = fakeTable(MAX_TOTAL_ROWS + PAGE_SIZE * 2)
    await expect(fetchAll(t.page)).rejects.toThrow(/too many/i)
  })
})

describe('chunk (a long list of ids in a web address is too long for the server, so it is sent in groups)', () => {
  it('splits into groups of the given size, keeping order', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('gives no groups for an empty list and one group for a short list', () => {
    expect(chunk([], 100)).toEqual([])
    expect(chunk(['a'], 100)).toEqual([['a']])
  })

  it('rejects a group size that would loop forever', () => {
    expect(() => chunk([1], 0)).toThrow()
  })
})
