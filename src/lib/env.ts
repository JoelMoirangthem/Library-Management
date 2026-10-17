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
