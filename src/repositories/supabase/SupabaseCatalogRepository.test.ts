import { describe, expect, it, vi } from 'vitest'
import { AppError } from '@/domain/errors'
import { PAGE_SIZE } from '@/repositories/supabase/paging'

/**
 * A fake Supabase client. Its RPC behaves like PostgREST for a function that returns a table: the rows come back in
 * the order asked for, and never more than 1000 per request, however many are asked for (see D-032 / D-036).
 */
const state = vi.hoisted(() => ({
  rows: [] as { name: string }[],
  calls: [] as { fn: string; args: unknown; order?: string; range?: [number, number] }[],
  fail: false,
}))

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    rpc: (fn: string, args: unknown) => {
      const call: (typeof state.calls)[number] = { fn, args }
      state.calls.push(call)
      const builder = {
        order: (column: string) => {
          call.order = column
          return builder
        },
        range: (from: number, to: number) => {
          call.range = [from, to]
          if (state.fail) return Promise.resolve({ data: null, error: { code: '42501', message: 'nope' } })
          const sorted = [...state.rows].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
          const end = Math.min(to, from + PAGE_SIZE - 1)
          return Promise.resolve({ data: sorted.slice(from, end + 1), error: null })
        },
      }
      return builder
    },
  }),
}))

const { SupabaseCatalogRepository } = await import('@/repositories/supabase/SupabaseCatalogRepository')

function setup(names: string[], fail = false) {
  state.rows = names.map((name) => ({ name }))
  state.calls = []
  state.fail = fail
  return new SupabaseCatalogRepository()
}

describe('SupabaseCatalogRepository.listAreaNames (the area list on Discover)', () => {
  it('asks the database for the area names of the chosen town', async () => {
    const repo = setup(['Aliganj', 'Gomti Nagar'])
    expect(await repo.listAreaNames('city-1')).toEqual(['Aliganj', 'Gomti Nagar'])
    expect(state.calls[0]).toMatchObject({ fn: 'area_names', args: { p_city: 'city-1' } })
  })

  it('reads page by page when a town has more than 1000 area names, and loses none', async () => {
    const names = Array.from({ length: 2300 }, (_, i) => `Area ${String(i).padStart(4, '0')}`)
    const repo = setup(names)
    const got = await repo.listAreaNames('city-1')
    expect(got).toHaveLength(2300)
    expect(new Set(got).size).toBe(2300)
    expect(state.calls.map((c) => c.range)).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
    expect(state.calls.every((c) => c.order === 'name')).toBe(true) // a unique sort order keeps pages from repeating rows
  })

  it('lists the names A-Z whatever their case', async () => {
    const repo = setup(['indira Nagar', 'Gomti Nagar', 'aliganj'])
    expect(await repo.listAreaNames('city-1')).toEqual(['aliganj', 'Gomti Nagar', 'indira Nagar'])
  })

  it('gives an empty list for a town with no areas', async () => {
    const repo = setup([])
    expect(await repo.listAreaNames('city-1')).toEqual([])
  })

  it('turns a database error into an app error, never a partial list', async () => {
    const repo = setup(['Aliganj'], true)
    await expect(repo.listAreaNames('city-1')).rejects.toBeInstanceOf(AppError)
  })
})
