// Pure parts of the admin-account tool: checking what was typed, and building the one SQL statement.
// The same rules the website uses (src/domain/adminLogin.ts) are imported, so the two can never drift apart.
import { randomBytes } from 'node:crypto'
import { ADMIN_LOGIN_DOMAIN, adminLoginEmail, adminPasswordProblem } from '../src/domain/adminLogin.ts'

/** @returns {{ ok: true, email: string, userId: string } | { ok: false, problem: string }} */
export function validateAdminInput(userId, password, again) {
  const email = adminLoginEmail(userId)
  if (!email) return { ok: false, problem: 'The user ID may only use letters, digits, dot, dash and underscore (1 to 64 characters).' }
  if (password !== again) return { ok: false, problem: 'The two passwords do not match.' }
  const id = userId.trim().toLowerCase()
  const weak = adminPasswordProblem(password, id)
  if (weak) return { ok: false, problem: weak }
  return { ok: true, email, userId: id }
}

/** An ordinary SQL string literal: single quotes doubled; backslashes are not special in standard Postgres strings. */
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`

/**
 * One statement that creates the administrator, or changes the password of the existing one. The database makes the
 * bcrypt hash itself (pgcrypto), so the plain password exists only inside this statement. It only ever touches an
 * address on the admin domain, so it can never alter a real person's account.
 */
export function buildAdminSql(email, displayName, password) {
  if (!email.toLowerCase().endsWith(`@${ADMIN_LOGIN_DOMAIN}`)) throw new Error(`The address must end with @${ADMIN_LOGIN_DOMAIN}`)
  // The statement is wrapped in $tag$ ... $tag$. A password containing the same tag could close the wrapper early and run
  // as SQL, so the tag is random and drawn again until it appears in none of the typed values.
  let tag
  do {
    tag = `t${randomBytes(6).toString('hex')}`
  } while ([email, displayName, password].some((v) => v.includes(tag)))
  const d = `$${tag}$`
  return `do ${d}
declare uid uuid;
begin
  perform set_config('studyseat.allow_email_user', 'on', true);
  select id into uid from auth.users where email = ${lit(email.toLowerCase())};
  if not found then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current,
      reauthentication_token, phone_change, phone_change_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', ${lit(email.toLowerCase())},
      extensions.crypt(${lit(password)}, extensions.gen_salt('bf', 12)), now(),
      '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', ${lit(displayName)}), now(), now(),
      '', '', '', '', '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid, uid::text, 'email', jsonb_build_object('sub', uid::text, 'email', ${lit(email.toLowerCase())}), now(), now(), now());
  else
    update auth.users set encrypted_password = extensions.crypt(${lit(password)}, extensions.gen_salt('bf', 12)),
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = uid;
  end if;
  update public.profiles set role = 'admin', name = ${lit(displayName)} where id = uid;
end
${d};
`
}