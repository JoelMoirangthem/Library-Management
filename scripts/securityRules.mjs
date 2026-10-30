// The safety rules the LIVE database must satisfy. Pure: it judges a plain description of the database ("facts"),
// so the rules can be unit-tested. scripts/securityCheck.mjs collects the facts from the real database and API.

/**
 * Functions a logged-out visitor may run. Each one is here on purpose:
 *  - public_libraries / public_library: the Discover pages for logged-out visitors.
 *  - is_admin, is_library_*, current_user_role: helpers the row-level-security rules call; for a stranger auth.uid() is
 *    null so they only ever answer "no".
 *  - trigger and constraint helpers (enforce_shift_rules, forbid_delete, freeze_fee_payment, handle_new_user,
 *    touch_updated_at, shift_overlaps, photos_are_valid): PostgreSQL requires the calling role to be able to run them
 *    while a write is checked; a trigger function cannot be called directly.
 * Anything not listed here (approve_library, verify_plan_payment, add_member ...) must NOT be runnable by a stranger.
 */
export const APPROVED_PUBLIC_FUNCTIONS = [
  'current_user_role', 'enforce_shift_rules', 'forbid_delete', 'freeze_fee_payment', 'handle_new_user',
  'is_admin', 'is_library_active', 'is_library_editable', 'is_library_owner', 'photos_are_valid',
  'public_libraries', 'public_library', 'shift_overlaps', 'touch_updated_at',
]

/** Place lists anyone may read (they hold no personal data). Exported so securityCheck.mjs skips them too. */
export const READ_ONLY_PUBLIC_TABLES = ['states', 'districts', 'cities', 'city_districts', 'areas']
const WRITE_ALLOWED_TABLES = ['cities', 'areas'] // admin-only through row-level security; towns are added through admin_add_city
// A new library is inserted directly and needs an owner; its row rule pins owner_id to the caller. It must never be UPDATE-able.
const INSERT_ONLY_OK = [{ table: 'libraries', column: 'owner_id', privilege: 'INSERT' }]

/** @returns {{ rule: string, ok: boolean, detail: string }[]} */
export function evaluateFacts(f) {
  const out = []
  const rule = (name, ok, detail) => out.push({ rule: name, ok, detail: ok ? '' : detail })
  const names = (list) => [...new Set(list)].sort().join(', ')

  const noRls = f.tables.filter((t) => !t.rls).map((t) => t.name)
  rule('every table has row level security', noRls.length === 0, `no row level security on: ${names(noRls)}`)

  const badAnon = f.anonTablePrivileges.filter((p) => !(p.privilege === 'SELECT' && READ_ONLY_PUBLIC_TABLES.includes(p.table)))
  rule('strangers can read only the place lists', badAnon.length === 0, `strangers hold: ${names(badAnon.map((p) => `${p.privilege} on ${p.table}`))}`)

  const badWrite = f.authenticatedWritePrivileges.filter((p) => !WRITE_ALLOWED_TABLES.includes(p.table))
  rule('logged-in users write directly only to cities and areas', badWrite.length === 0, `direct writes allowed on: ${names(badWrite.map((p) => `${p.privilege} ${p.table}`))}`)

  const badCols = f.sensitiveColumnWrites.filter((c) => !INSERT_ONLY_OK.some((ok) => ok.table === c.table && ok.column === c.column && ok.privilege === c.privilege))
  rule('no sensitive column can be changed directly', badCols.length === 0, `changeable: ${names(badCols.map((c) => `${c.table}.${c.column} (${c.privilege})`))}`)

  const extra = f.anonFunctions.filter((n) => !APPROVED_PUBLIC_FUNCTIONS.includes(n))
  rule('strangers can run only the approved functions', extra.length === 0, `also runnable by strangers: ${names(extra)}`)

  rule('every security-definer function pins its search path', f.definerWithoutSearchPath.length === 0, `no pinned search path: ${names(f.definerWithoutSearchPath)}`)

  rule('new tables are closed by default', f.defaultGrantsToWebRoles.length === 0, 'new tables would be handed to anon/authenticated automatically (run migration 0012)')

  const b = f.buckets.find((x) => x.id === 'LibraryImages')
  const bucketOk = Boolean(b) && b.fileSizeLimit != null && b.fileSizeLimit <= 5 * 1024 * 1024 && Array.isArray(b.mimeTypes) && b.mimeTypes.length > 0 && b.mimeTypes.every((m) => m === 'image/jpeg' || m === 'image/png')
  rule('the photo bucket accepts only small JPEG and PNG files', bucketOk, b ? `limit=${b.fileSizeLimit} types=${(b.mimeTypes ?? []).join(',')}` : 'bucket LibraryImages is missing')

  const badStorage = f.storagePolicies.filter((p) => p.cmd === 'UPDATE' || p.cmd === 'ALL' || p.roles.some((r) => r === 'anon' || r === 'public'))
  rule('storage rules never serve strangers and never allow overwriting', badStorage.length === 0, `risky storage policies: ${names(badStorage.map((p) => `${p.name} (${p.cmd})`))}`)

  rule('the live API returns no private table to a stranger', f.anonCanReadTables.length === 0, `a stranger could read rows of: ${names(f.anonCanReadTables)}`)

  // Email + password is switched on only for the administrator. The database refuses any other email account at creation;
  // this proves the refusal is still installed, and that no other email account slipped in some other way.
  const g = f.emailSignupGuard
  rule('strangers cannot register an email account', Boolean(g && g.exists && g.enabled), 'the trigger that refuses email sign-ups is missing or disabled (migration 0013)')

  rule('the only email accounts are administrator accounts', f.emailAccountsOutsideAdminDomain.length === 0, `${f.emailAccountsOutsideAdminDomain.length} email account(s) exist that are not on the administrator domain`)

  return out
}