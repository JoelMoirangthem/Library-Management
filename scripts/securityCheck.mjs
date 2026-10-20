// Collects the real facts about the LIVE database and API and judges them with scripts/securityRules.mjs.
//   npm run security:check
// Read-only: it only runs SELECT statements and one anonymous read of each table. Needs SUPABASE_DB_PASSWORD in .env.
import { spawnSync } from 'node:child_process'
import { writeFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDbUrl, maskSecret, quoteForCmd } from './dbUrl.mjs'
import { evaluateFacts } from './securityRules.mjs'

const env = process.env
let url
try { url = buildDbUrl(env) } catch (e) { console.error(e.message); process.exit(2) }
const secret = env.SUPABASE_DB_PASSWORD.trim()
const windows = process.platform === 'win32'

/** Runs one SELECT through the Supabase CLI and returns its rows. */
function rows(sql) {
  const file = join(tmpdir(), `securitycheck-${process.pid}.sql`)
  writeFileSync(file, sql)
  const args = ['db', 'query', '--db-url', url, '--output-format', 'json', '-f', file]
  const run = spawnSync('supabase', windows ? args.map(quoteForCmd) : args, { encoding: 'utf8', shell: windows })
  unlinkSync(file)
  if (run.status !== 0) { console.error(maskSecret(run.stderr || run.stdout || 'query failed', secret)); process.exit(2) }
  const out = run.stdout; const s = out.indexOf('['); const e = out.lastIndexOf(']')
  return s < 0 ? [] : JSON.parse(out.slice(s, e + 1))
}

// Columns that decide who someone is, who owns what, whether a library is live, and money. None may be writable by a user.
const SENSITIVE = {
  profiles: ['role'], libraries: ['owner_id', 'approval_status', 'rejection_reason'],
  subscriptions: ['trial_ends_at', 'active_until'], plan_payments: ['amount_paise', 'status', 'verified_by', 'verified_at', 'utr'],
  fee_payments: ['amount_paise', 'is_void'], members: ['status'], seat_requests: ['status'],
}
const sensitiveSql = Object.entries(SENSITIVE).flatMap(([t, cols]) => cols.map((c) => `('${t}','${c}')`)).join(',')

const facts = {
  tables: rows(`select c.relname as name, c.relrowsecurity as rls from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' order by 1`),
  anonTablePrivileges: rows(`select table_name as "table", privilege_type as privilege from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public'`),
  authenticatedWritePrivileges: rows(`select table_name as "table", privilege_type as privilege from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type <> 'SELECT'`),
  sensitiveColumnWrites: rows(`select s.t as "table", s.c as "column", p.priv as privilege from (values ${sensitiveSql}) as s(t, c) cross join (values ('INSERT'), ('UPDATE')) as p(priv) where has_column_privilege('authenticated', format('public.%I', s.t)::regclass, s.c, p.priv) or has_column_privilege('anon', format('public.%I', s.t)::regclass, s.c, p.priv) order by 1,2,3`),
  anonFunctions: rows(`select p.proname as name from pg_proc p where p.pronamespace = 'public'::regnamespace and has_function_privilege('anon', p.oid, 'execute') order by 1`).map((r) => r.name),
  definerWithoutSearchPath: rows(`select p.proname as name from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosecdef and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`).map((r) => r.name),
  defaultGrantsToWebRoles: rows(`select d.defaclobjtype as kind, d.defaclacl::text as acl from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace where n.nspname = 'public' and d.defaclobjtype in ('r','S') and pg_get_userbyid(d.defaclrole) = 'postgres' and (d.defaclacl::text like '%anon=%' or d.defaclacl::text like '%authenticated=%')`),
  buckets: rows(`select id, public, file_size_limit as "fileSizeLimit", allowed_mime_types as "mimeTypes" from storage.buckets`),
  storagePolicies: rows(`select policyname as name, cmd, roles::text as roles from pg_policies where schemaname = 'storage' and tablename = 'objects'`).map((p) => ({ name: p.name, cmd: p.cmd, roles: String(p.roles).replace(/[{}]/g, '').split(',').filter(Boolean) })),
  anonCanReadTables: [],
}
facts.buckets = facts.buckets.map((b) => ({ ...b, mimeTypes: Array.isArray(b.mimeTypes) ? b.mimeTypes : String(b.mimeTypes ?? '').replace(/[{}]/g, '').split(',').filter(Boolean) }))

// Ask the public API, as a stranger, for one row of every table: nothing private may come back.
const apiUrl = (env.VITE_SUPABASE_URL ?? '').trim().replace(/\/$/, ''); const anon = (env.VITE_SUPABASE_ANON_KEY ?? '').trim()
if (!apiUrl || !anon) { console.error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are needed in .env'); process.exit(2) }
for (const t of facts.tables.map((x) => x.name).filter((n) => !['cities', 'areas'].includes(n))) {
  const r = await fetch(`${apiUrl}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: anon, authorization: `Bearer ${anon}` } })
  const body = r.ok ? await r.json().catch(() => null) : null
  if (r.ok && Array.isArray(body) && body.length > 0) facts.anonCanReadTables.push(t)
}

const results = evaluateFacts(facts)
console.log(`Security check of the live database (${facts.tables.length} tables, ${facts.anonFunctions.length} functions open to strangers)\n`)
for (const r of results) console.log(`${r.ok ? '  PASS' : '  FAIL'}  ${r.rule}${r.ok ? '' : '\n          -> ' + r.detail}`)
const failed = results.filter((r) => !r.ok).length
console.log(failed ? `\n${failed} rule(s) FAILED.` : `\nAll ${results.length} rules hold.`)
process.exit(failed ? 1 : 0)