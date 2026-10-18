import { AppError, type ErrorCode } from '@/domain/errors'

type PostgrestLike = { code?: string; message?: string; status?: number } | null | undefined

/**
 * Turns a Supabase / Postgres error into the app's own AppError.
 * The database functions raise plain sentences on purpose, so the message is passed through.
 */
export function toAppErrorFromSupabase(error: PostgrestLike): AppError {
  const message = error?.message?.trim() || 'Something went wrong.'
  if (/failed to fetch|network|load failed/i.test(message)) {
    return new AppError('network', 'Could not reach the server. Check your connection and try again.')
  }
  const byCode: Record<string, ErrorCode> = {
    '42501': 'forbidden', // insufficient_privilege (also row-level security)
    '23505': 'conflict', // unique_violation
    '23514': 'invalid', // check_violation
    '23503': 'invalid', // foreign_key_violation
    '22023': 'invalid', // invalid_parameter_value
    '23P01': 'conflict', // exclusion_violation (shift overlap)
    '23001': 'conflict', // restrict_violation
    P0002: 'not_found', // no_data_found
    PGRST116: 'not_found', // no row for .single()
  }
  const code = (error?.code && byCode[error.code]) || 'unknown'
  // Row-level security says "new row violates row-level security policy"; make that readable.
  if (code === 'forbidden' && /row-level security/i.test(message)) {
    return new AppError('forbidden', 'You do not have access to this.')
  }
  return new AppError(code, message)
}

/** Throws an AppError if the Supabase response carries an error, otherwise returns its data. */
export function unwrap<T>(result: { data: T | null; error: PostgrestLike }): T {
  if (result.error) throw toAppErrorFromSupabase(result.error)
  return result.data as T
}
