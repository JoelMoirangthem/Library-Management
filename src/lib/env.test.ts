import { describe, expect, it } from 'vitest'
import { DEMO_UPI_ID, EnvError, parseEnv, parseUpiId, resolveDataMode, UpiConfigError } from '@/lib/env'

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

describe('parseUpiId (the UPI ID owners pay to comes only from VITE_UPI_ID)', () => {
  it('returns the configured UPI ID, trimmed', () => {
    expect(parseUpiId({ VITE_UPI_ID: '  mystudyseat@okhdfcbank ' }, 'supabase')).toBe('mystudyseat@okhdfcbank')
    expect(parseUpiId({ VITE_UPI_ID: '9876543210@ybl' }, 'supabase')).toBe('9876543210@ybl')
  })

  it('in real mode a missing or blank value is an error, never a made-up UPI ID', () => {
    expect(() => parseUpiId({}, 'supabase')).toThrow(UpiConfigError)
    expect(() => parseUpiId({ VITE_UPI_ID: '   ' }, 'supabase')).toThrow(/VITE_UPI_ID/)
  })

  it('rejects values that are not a UPI ID (name@bank)', () => {
    for (const bad of ['studyseat', '@upi', 'a@', 'two words@upi', 'a@b@c', 'x@1bank', 'upi://pay?pa=a@b']) {
      expect(() => parseUpiId({ VITE_UPI_ID: bad }, 'supabase'), bad).toThrow(/not a valid UPI ID/)
    }
  })

  it('dummy mode falls back to an obviously fake demo ID so it runs with no keys', () => {
    expect(parseUpiId({}, 'mock')).toBe(DEMO_UPI_ID)
    expect(DEMO_UPI_ID).toBe('demo@upi')
  })

  it('dummy mode still uses the env value when one is set', () => {
    expect(parseUpiId({ VITE_UPI_ID: 'mine@oksbi' }, 'mock')).toBe('mine@oksbi')
  })
})

describe('resolveDataMode (a production build must never fall back to dummy data by accident)', () => {
  it('development defaults to dummy mode', () => {
    expect(resolveDataMode(undefined, false)).toBe('mock')
    expect(resolveDataMode('', false)).toBe('mock')
  })

  it('production defaults to the real backend when the setting is missing', () => {
    expect(resolveDataMode(undefined, true)).toBe('supabase')
    expect(resolveDataMode('', true)).toBe('supabase')
    expect(resolveDataMode('nonsense', true)).toBe('supabase')
  })

  it('an explicit value always wins, in both builds', () => {
    expect(resolveDataMode('supabase', false)).toBe('supabase')
    expect(resolveDataMode('supabase', true)).toBe('supabase')
    expect(resolveDataMode('mock', false)).toBe('mock')
    expect(resolveDataMode('mock', true)).toBe('mock')
  })
})
