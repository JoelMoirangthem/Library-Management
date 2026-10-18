export type AppEnv = {
  supabaseUrl: string
  supabaseAnonKey: string
}

export class EnvError extends Error {
  readonly missing: string[]

  constructor(missing: string[]) {
    super(
      `Missing environment variable(s): ${missing.join(', ')}. ` +
        'Copy .env.example to .env and fill them in from Supabase: Project Settings -> API.',
    )
    this.name = 'EnvError'
    this.missing = missing
  }
}

/** Pure: validates a raw env record so it can be tested without Vite. */
export function parseEnv(raw: Record<string, string | undefined>): AppEnv {
  const url = raw.VITE_SUPABASE_URL?.trim()
  const key = raw.VITE_SUPABASE_ANON_KEY?.trim()

  const missing: string[] = []
  if (!url) missing.push('VITE_SUPABASE_URL')
  if (!key) missing.push('VITE_SUPABASE_ANON_KEY')
  if (missing.length > 0 || !url || !key) throw new EnvError(missing)

  return { supabaseUrl: url, supabaseAnonKey: key }
}

/** Reads the real Vite env. Call lazily so the app can render before Supabase is configured. */
export function getEnv(): AppEnv {
  return parseEnv(import.meta.env)
}

/** Shown instead of a real UPI ID in dummy mode when VITE_UPI_ID is not set. Obviously fake on purpose. */
export const DEMO_UPI_ID = 'demo@upi'

export class UpiConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UpiConfigError'
  }
}

/** A UPI ID (VPA) is 
ame@bank: letters, digits, dot, dash or underscore, then @, then letters. */
const UPI_ID_PATTERN = /^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/

/**
 * The UPI ID owners pay the plan fee to. It comes ONLY from the VITE_UPI_ID setting.
 * Real mode: missing or malformed is an error, so a wrong or made-up payment address can never be shown.
 * Dummy mode: falls back to demo@upi so the app still runs with no keys.
 * Pure so it can be tested without Vite.
 */
export function parseUpiId(raw: Record<string, string | undefined>, mode: 'mock' | 'supabase'): string {
  const value = raw.VITE_UPI_ID?.trim()
  if (!value) {
    if (mode === 'mock') return DEMO_UPI_ID
    throw new UpiConfigError('VITE_UPI_ID is not set. Add the UPI ID that receives the plan payments to your environment settings.')
  }
  if (!UPI_ID_PATTERN.test(value)) {
    throw new UpiConfigError('VITE_UPI_ID is not a valid UPI ID. It should look like name@bank.')
  }
  return value
}

/** Reads the real Vite env. Throws UpiConfigError in real mode when it is missing or invalid. */
export function getUpiId(): string {
  return parseUpiId(import.meta.env, resolveDataMode(import.meta.env.VITE_DATA_MODE, import.meta.env.PROD))
}

export type DataMode = 'mock' | 'supabase'

/**
 * Which data the app runs on. An explicit mock or supabase always wins. When the setting is missing or
 * unreadable, a development build uses dummy data (no keys needed) but a PRODUCTION build uses the real
 * backend, so forgetting this one setting on the host can never ship fake data and the demo panel to real users.
 */
export function resolveDataMode(value: string | undefined, isProduction: boolean): DataMode {
  if (value === 'mock' || value === 'supabase') return value
  return isProduction ? 'supabase' : 'mock'
}
