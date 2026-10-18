import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getEnv } from '@/lib/env'

let client: SupabaseClient | undefined

/**
 * The only module (with repositories/supabase/*) allowed to import supabase-js.
 * Created on first use so a missing .env fails with a clear message, not a blank page.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const { supabaseUrl, supabaseAnonKey } = getEnv()
    client = createClient(supabaseUrl, supabaseAnonKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } })
  }
  return client
}
