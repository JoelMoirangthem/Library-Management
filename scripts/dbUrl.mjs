// Builds the database connection address for admin tools (migrations, checks) from .env, so the password is
// typed once, as plain text, in a git-ignored file and never pasted into a command or a chat.
// None of these names start with VITE_, so Vite never copies them into the website that visitors download.

/** The pooler host this project has used. Another region or project: set SUPABASE_DB_HOST in .env. */
export const DEFAULT_DB_HOST = 'aws-0-ap-southeast-2.pooler.supabase.com'

/** `https://<ref>.supabase.co` gives `<ref>`. */
export function projectRefFromUrl(url) {
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/.exec((url ?? '').trim())
  if (!m) throw new Error('VITE_SUPABASE_URL in .env must look like https://<project-id>.supabase.co')
  return m[1]
}

/** postgresql://postgres.<ref>:<encoded password>@<host>:5432/postgres */
export function buildDbUrl(env) {
  const ref = projectRefFromUrl(env.VITE_SUPABASE_URL)
  const password = env.SUPABASE_DB_PASSWORD?.trim()
  if (!password) throw new Error('SUPABASE_DB_PASSWORD is not set in .env. Put the database password there as plain text.')
  const host = (env.SUPABASE_DB_HOST ?? '').trim() || DEFAULT_DB_HOST
  if (/[/:@\s]/.test(host)) throw new Error('SUPABASE_DB_HOST must be a host name such as aws-0-ap-southeast-2.pooler.supabase.com')
  return `postgresql://postgres.${ref}:${encodeURIComponent(password)}@${host}:5432/postgres`
}

/** Replaces the password, in plain and encoded form, so tool output can be shown safely. */
export function maskSecret(text, secret) {
  if (!secret) return text
  return text.split(encodeURIComponent(secret)).join('****').split(secret).join('****')
}

/**
 * Windows only. Node starts the CLI through the command shell, which splits unquoted text at spaces, so every argument
 * is wrapped in double quotes; a double quote inside is escaped and a trailing backslash is doubled.
 */
export function quoteForCmd(arg) {
  return `"${String(arg).replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1')}"`
}
