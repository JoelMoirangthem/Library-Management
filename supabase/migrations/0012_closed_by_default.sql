-- StudySeat migration 0012: new tables are closed by default; one more function pinned.
--
-- (D1) Supabase gives the web-facing roles anon and authenticated full privileges on every table and sequence created
--      later in schema public. Today all 11 tables are locked down by migration 0003, so nothing is exposed, but a future
--      table created without that step would be readable and writable by the public until someone remembered row level
--      security. Take that default away: from now on a new table or sequence grants nothing to anon or authenticated, and
--      a migration must grant exactly what it needs (as every migration so far already does).
--      This changes the default for objects created by the role that runs the migrations (postgres). The default of the
--      Supabase-internal role supabase_admin cannot be changed from here and is not used by this project's migrations.
--
--      FUNCTIONS are different and this migration does NOT close them: Postgres itself lets everyone (the built-in PUBLIC
--      group) execute a new function, and revoking from anon/authenticated does not remove that. The rule for functions
--      stays what every migration already does: `revoke all on function ... from public, anon, authenticated;` and then
--      grant what is needed. `npm run security:check` fails if a function is executable by anon that is not on its
--      approved list, so a forgotten revoke is caught before a deploy.
--      The line below only removes the explicit grants Supabase adds on top of PUBLIC's.
--
-- (D2) today_ist() was the one function without a pinned search_path. It reads no tables, so this is only tidiness.

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;

alter function public.today_ist() set search_path = public;