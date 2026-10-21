/**
 * The administrator signs in with a user ID and a password on the /admin-login page.
 * Supabase signs people in by an email-shaped address, so the user ID is turned into one on a domain that
 * can never receive mail (".invalid" is reserved for exactly this) and that nobody can own a Google account on:
 * a Google user can therefore never be merged into, or take over, the admin account.
 */
export const ADMIN_LOGIN_DOMAIN = 'admin.studyseat.invalid'

const USER_ID_PATTERN = /^[a-z0-9._-]{1,64}$/

/** The internal sign-in address for a user ID, or null when the user ID is not acceptable. */
export function adminLoginEmail(userId: string): string | null {
  const id = userId.trim().toLowerCase()
  return USER_ID_PATTERN.test(id) ? `${id}@${ADMIN_LOGIN_DOMAIN}` : null
}

export function isAdminLoginEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${ADMIN_LOGIN_DOMAIN}`)
}

/** Words and number patterns that are tried first by anyone guessing. */
const GUESSABLE = ['password', 'passw0rd', 'admin', 'hello', 'welcome', 'studyseat', 'nearme', 'study', 'library', 'qwerty', 'asdf', 'letmein', '123456', 'abcdef']

/**
 * Why a password is not good enough for the administrator, or null when it is.
 * The account approves libraries and verifies money, so the bar is high and the reasons are specific.
 */
export function adminPasswordProblem(password: string, userId: string): string | null {
  if (password.length < 14) return 'Use at least 14 characters.'
  if (!/[a-z]/.test(password)) return 'Add small letters.'
  if (!/[A-Z]/.test(password)) return 'Add capital letters.'
  if (!/[0-9]/.test(password)) return 'Add a digit.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Add a symbol such as ! # $ or @.'
  const lower = password.toLowerCase()
  const id = userId.trim().toLowerCase()
  if (id.length >= 4 && lower.includes(id)) return 'The password must not contain the user ID.'
  const hit = GUESSABLE.find((w) => lower.includes(w))
  if (hit) return `Avoid easy words such as "${hit}".`
  if (/(?:19|20)\d\d/.test(password)) return 'Avoid years such as 2028: they are the first thing tried.'
  if (/(.)\1{3,}/.test(password)) return 'Avoid repeating the same character.'
  return null
}