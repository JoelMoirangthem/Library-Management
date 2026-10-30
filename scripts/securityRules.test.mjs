import { describe, expect, it } from 'vitest'
import { APPROVED_PUBLIC_FUNCTIONS, evaluateFacts } from './securityRules.mjs'

/** A database that is exactly as the project intends. Each test below spoils one thing. */
const good = () => ({
  tables: [
    { name: 'profiles', rls: true }, { name: 'libraries', rls: true }, { name: 'members', rls: true },
    { name: 'cities', rls: true }, { name: 'areas', rls: true },
    { name: 'states', rls: true }, { name: 'districts', rls: true }, { name: 'city_districts', rls: true },
  ],
  anonTablePrivileges: ['states', 'districts', 'cities', 'city_districts', 'areas'].map((table) => ({ table, privilege: 'SELECT' })),
  authenticatedWritePrivileges: [{ table: 'cities', privilege: 'UPDATE' }, { table: 'areas', privilege: 'INSERT' }, { table: 'areas', privilege: 'UPDATE' }],
  sensitiveColumnWrites: [],
  anonFunctions: [...APPROVED_PUBLIC_FUNCTIONS],
  definerWithoutSearchPath: [],
  defaultGrantsToWebRoles: [],
  buckets: [{ id: 'LibraryImages', public: true, fileSizeLimit: 5242880, mimeTypes: ['image/jpeg', 'image/png'] }],
  storagePolicies: [
    { name: 'owners upload into their own folder', cmd: 'INSERT', roles: ['authenticated'] },
    { name: 'owners list their own photos', cmd: 'SELECT', roles: ['authenticated'] },
    { name: 'owners delete their own photos', cmd: 'DELETE', roles: ['authenticated'] },
  ],
  anonCanReadTables: [],
  emailSignupGuard: { exists: true, enabled: true },
  emailAccountsOutsideAdminDomain: [],
})

const failures = (facts) => evaluateFacts(facts).filter((r) => !r.ok).map((r) => r.rule)

describe('evaluateFacts (the safety rules the live database must satisfy)', () => {
  it('passes for a database that is exactly as intended', () => {
    expect(failures(good())).toEqual([])
  })

  it('fails when a table has no row level security', () => {
    const f = good(); f.tables.push({ name: 'forgotten', rls: false })
    expect(failures(f)).toContain('every table has row level security')
  })

  it('fails when the public can read a private table', () => {
    const f = good(); f.anonTablePrivileges.push({ table: 'profiles', privilege: 'SELECT' })
    expect(failures(f)).toContain('strangers can read only the place lists')
  })

  it('fails when the public can write anything', () => {
    const f = good(); f.anonTablePrivileges.push({ table: 'cities', privilege: 'INSERT' })
    expect(failures(f)).toContain('strangers can read only the place lists')
  })

  it('fails when a logged-in user can write the state or district lists', () => {
    const f = good(); f.authenticatedWritePrivileges.push({ table: 'districts', privilege: 'INSERT' })
    expect(failures(f)).toContain('logged-in users write directly only to cities and areas')
  })

  it('fails when a logged-in user can write a table directly that should only change through functions', () => {
    const f = good(); f.authenticatedWritePrivileges.push({ table: 'plan_payments', privilege: 'UPDATE' })
    expect(failures(f)).toContain('logged-in users write directly only to cities and areas')
  })

  it('fails when a sensitive column can be changed directly', () => {
    const f = good(); f.sensitiveColumnWrites.push({ table: 'profiles', column: 'role', privilege: 'UPDATE' })
    expect(failures(f)).toContain('no sensitive column can be changed directly')
  })

  it('fails when a column that must never be set by a user can be set on insert', () => {
    const f = good(); f.sensitiveColumnWrites.push({ table: 'plan_payments', column: 'amount_paise', privilege: 'INSERT' })
    expect(failures(f)).toContain('no sensitive column can be changed directly')
  })

  it('accepts libraries.owner_id on INSERT only: a new library needs an owner and the row rule pins it to the caller', () => {
    const f = good(); f.sensitiveColumnWrites.push({ table: 'libraries', column: 'owner_id', privilege: 'INSERT' })
    expect(failures(f)).toEqual([])
  })

  it('does NOT accept libraries.owner_id on UPDATE: that would let a library be handed to someone else', () => {
    const f = good(); f.sensitiveColumnWrites.push({ table: 'libraries', column: 'owner_id', privilege: 'UPDATE' })
    expect(failures(f)).toContain('no sensitive column can be changed directly')
  })

  it('fails when a function the public should not run is open to them', () => {
    const f = good(); f.anonFunctions.push('approve_library')
    expect(failures(f)).toContain('strangers can run only the approved functions')
  })

  it('fails when a security-definer function has no pinned search path', () => {
    const f = good(); f.definerWithoutSearchPath.push('some_fn')
    expect(failures(f)).toContain('every security-definer function pins its search path')
  })

  it('fails when new tables would be handed to the web roles automatically', () => {
    const f = good(); f.defaultGrantsToWebRoles.push({ kind: 'r', acl: 'anon=arwdDxtm/postgres' })
    expect(failures(f)).toContain('new tables are closed by default')
  })

  it('fails when the guard that refuses email sign-ups is missing or switched off', () => {
    const gone = good(); gone.emailSignupGuard = { exists: false, enabled: false }
    expect(failures(gone)).toContain('strangers cannot register an email account')
    const off = good(); off.emailSignupGuard = { exists: true, enabled: false }
    expect(failures(off)).toContain('strangers cannot register an email account')
  })

  it('fails when an email account exists that is not on the administrator domain', () => {
    const f = good(); f.emailAccountsOutsideAdminDomain = ['someone@gmail.com']
    expect(failures(f)).toContain('the only email accounts are administrator accounts')
  })

  it('does not print the stranger email address in the failure detail more than needed', () => {
    const f = good(); f.emailAccountsOutsideAdminDomain = ['a@b.com', 'c@d.com']
    const r = evaluateFacts(f).find((x) => x.rule === 'the only email accounts are administrator accounts')
    expect(r.detail).toMatch(/2/)
    expect(r.detail).not.toContain('a@b.com')
  })

  it('fails when the photo bucket allows other file types or is too large', () => {
    const f = good(); f.buckets[0].mimeTypes = ['image/jpeg', 'image/png', 'text/html']
    expect(failures(f)).toContain('the photo bucket accepts only small JPEG and PNG files')
    const g = good(); g.buckets[0].fileSizeLimit = null
    expect(failures(g)).toContain('the photo bucket accepts only small JPEG and PNG files')
  })

  it('fails when a storage policy lets strangers act or lets anyone update files', () => {
    const f = good(); f.storagePolicies.push({ name: 'x', cmd: 'SELECT', roles: ['anon'] })
    expect(failures(f)).toContain('storage rules never serve strangers and never allow overwriting')
    const g = good(); g.storagePolicies.push({ name: 'y', cmd: 'UPDATE', roles: ['authenticated'] })
    expect(failures(g)).toContain('storage rules never serve strangers and never allow overwriting')
  })

  it('fails when a stranger can actually read a private table through the API', () => {
    const f = good(); f.anonCanReadTables.push('members')
    expect(failures(f)).toContain('the live API returns no private table to a stranger')
  })

  it('names every rule it checked, so a silent skip is visible', () => {
    expect(evaluateFacts(good()).map((r) => r.rule)).toEqual([
      'every table has row level security',
      'strangers can read only the place lists',
      'logged-in users write directly only to cities and areas',
      'no sensitive column can be changed directly',
      'strangers can run only the approved functions',
      'every security-definer function pins its search path',
      'new tables are closed by default',
      'the photo bucket accepts only small JPEG and PNG files',
      'storage rules never serve strangers and never allow overwriting',
      'the live API returns no private table to a stranger',
      'strangers cannot register an email account',
      'the only email accounts are administrator accounts',
    ])
  })
})