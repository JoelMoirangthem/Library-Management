export type ErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'conflict'
  | 'invalid'
  | 'network'
  | 'unknown'

/** The only error type the UI sees. Repositories map backend errors into this. */
export class AppError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'AppError'
    this.code = code
  }
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) return e
  return new AppError('unknown', e instanceof Error ? e.message : 'Something went wrong')
}
