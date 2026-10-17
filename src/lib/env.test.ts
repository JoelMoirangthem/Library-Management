import { describe, expect, it } from 'vitest'
import { EnvError, parseEnv } from '@/lib/env'

describe('parseEnv', () => {
  it('returns the values when both variables are set', () => {
    const env = parseEnv({
      VITE_SUPABASE_URL: ' https://abc.supabase.co ',
      VITE_SUPABASE_ANON_KEY: 'anon',
    })
    expect(env).toEqual({ supabaseUrl: 'https://abc.supabase.co', supabaseAnonKey: 'anon' })
  })

  it('names every missing variable', () => {
    try {
      parseEnv({})
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(EnvError)
      expect((e as EnvError).missing).toEqual(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
    }
  })

  it('treats blank values as missing', () => {
    expect(() => parseEnv({ VITE_SUPABASE_URL: '  ', VITE_SUPABASE_ANON_KEY: 'k' })).toThrow(
      /VITE_SUPABASE_URL/,
    )
  })
})
