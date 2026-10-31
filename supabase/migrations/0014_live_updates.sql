-- NearMe Library migration 0014: live updates without refreshing the page.
--
-- WHAT: when a row that someone's screen shows changes, the database sends a tiny "changed" ping (Supabase Realtime
-- Broadcast, private channel) to exactly the people who can see that row. The ping carries NO data. The app reacts by
-- reloading through its normal reads, which are still checked by row-level security. So even a leaked ping reveals nothing.
--
-- WHO GETS A PING (topic `user:<id>`, plus the shared topic `admin`):
--   seat_requests   -> the student who asked, the library's owner
--   members         -> the student (when linked to an account), the library's owner
--   fee_payments    -> the library's owner, the member's student
--   plan_payments   -> the library's owner, admins
--   subscriptions   -> the library's owner, admins
--   libraries       -> the library's owner, admins
--
-- WHO MAY LISTEN: a signed-in person may join only `user:<their own id>`; an admin may also join `admin`. There is no
-- INSERT rule on realtime.messages, so no web client can send or forge a ping.

-- One helper per audience. Called only by the trigger functions below; nobody can run them from the web.
create function public.live_ping_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is not null then
    perform realtime.send('{}'::jsonb, 'changed', 'user:' || p_user::text, true);
  end if;
end;
$$;

create function public.live_ping_admins()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send('{}'::jsonb, 'changed', 'admin', true);
end;
$$;

-- Trigger functions: one per table, because each table finds its audience differently.
create function public.live_seat_requests() returns trigger language plpgsql security definer set search_path = public as $$
declare lib uuid := coalesce(new.library_id, old.library_id);
begin
  perform public.live_ping_user(coalesce(new.student_id, old.student_id));
  perform public.live_ping_user((select owner_id from public.libraries where id = lib));
  return null;
end;
$$;

create function public.live_members() returns trigger language plpgsql security definer set search_path = public as $$
declare lib uuid := coalesce(new.library_id, old.library_id);
begin
  perform public.live_ping_user(coalesce(new.student_id, old.student_id));
  perform public.live_ping_user((select owner_id from public.libraries where id = lib));
  return null;
end;
$$;

create function public.live_fee_payments() returns trigger language plpgsql security definer set search_path = public as $$
declare lib uuid := coalesce(new.library_id, old.library_id);
        mem uuid := coalesce(new.member_id, old.member_id);
begin
  perform public.live_ping_user((select owner_id from public.libraries where id = lib));
  perform public.live_ping_user((select student_id from public.members where id = mem));
  return null;
end;
$$;

create function public.live_library_owner_and_admins() returns trigger language plpgsql security definer set search_path = public as $$
declare lib uuid := coalesce(new.library_id, old.library_id);
begin
  perform public.live_ping_user((select owner_id from public.libraries where id = lib));
  perform public.live_ping_admins();
  return null;
end;
$$;

create function public.live_libraries() returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.live_ping_user(coalesce(new.owner_id, old.owner_id));
  perform public.live_ping_admins();
  return null;
end;
$$;

-- Nobody can run any of these from the web. They only ever run as triggers.
revoke all on function public.live_ping_user(uuid), public.live_ping_admins(), public.live_seat_requests(), public.live_members(),
  public.live_fee_payments(), public.live_library_owner_and_admins(), public.live_libraries()
  from public, anon, authenticated;

create trigger live_seat_requests after insert or update or delete on public.seat_requests for each row execute function public.live_seat_requests();
create trigger live_members after insert or update or delete on public.members for each row execute function public.live_members();
create trigger live_fee_payments after insert or update or delete on public.fee_payments for each row execute function public.live_fee_payments();
create trigger live_plan_payments after insert or update or delete on public.plan_payments for each row execute function public.live_library_owner_and_admins();
create trigger live_subscriptions after insert or update or delete on public.subscriptions for each row execute function public.live_library_owner_and_admins();
create trigger live_libraries after insert or update or delete on public.libraries for each row execute function public.live_libraries();

-- Who may listen. Row level security is already on for realtime.messages (Supabase enables it; do not alter the table).
create policy live_updates_listen on realtime.messages
for select to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and (
    (select realtime.topic()) = 'user:' || (select auth.uid())::text
    or ((select realtime.topic()) = 'admin' and (select public.is_admin()))
  )
);