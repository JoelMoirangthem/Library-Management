-- StudySeat migration 0013: nobody can create an account with email + password; Google is the only way in.
--
-- WHY: the admin signs in with a user ID and password (the /admin-login page), which needs Supabase's Email sign-in
-- provider switched ON. With it on, Supabase also lets any stranger start an email sign-up through its API. StudySeat has
-- no email sign-up page and does not want accounts created that way (they would skip Google and could pick a role).
--
-- WHAT: a guard that runs before ANY row is added to auth.users. It refuses a user whose sign-in method is `email`
-- unless the SQL session that creates it has said so with `set local studyseat.allow_email_user = 'on'`. Only someone
-- with database access (the project owner, running SQL) can say that; the web API cannot set it. Existing email users
-- (the admin) are unaffected and can still sign in: the guard only watches NEW accounts. Google sign-ins have the sign-in
-- method `google` and are untouched.
--
-- Result: with the Email provider ON, a stranger's sign-up is refused by the database itself, whatever the dashboard says.

create function public.refuse_unapproved_email_users()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') = 'email'
     and coalesce(current_setting('studyseat.allow_email_user', true), '') <> 'on' then
    raise exception 'Sign up with Google. Email accounts are not open for registration.'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

revoke all on function public.refuse_unapproved_email_users() from public, anon, authenticated;

create trigger refuse_unapproved_email_users
  before insert on auth.users
  for each row execute function public.refuse_unapproved_email_users();