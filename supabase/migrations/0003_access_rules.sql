-- StudySeat migration 0003: access rules (part A).
-- Who can read and write what, set-once roles, and the shift integrity rules.
-- Part B (migration 0004) adds the business functions: approve library, verify payment, renew,
-- approve request, public search. Until then, every write other than the ones below is impossible
-- from the browser, which is the safe default.
--
-- Design rules:
--   * Table privileges are cut back to the minimum, then Row Level Security narrows them per row.
--   * Money, plan dates, approval status, seats and memberships are NEVER written directly by the
--     browser. They change only through functions (part B), so the database decides.
--   * Public visitors read libraries through a function (part B) that hides owner ids and reasons.

-- ---------------------------------------------------------------- helper functions used by policies
create function public.current_user_role()
returns text
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;

create function public.is_library_owner(lib uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.libraries where id = lib and owner_id = auth.uid()) $$;

-- Approved and inside the paid or trial period: students can see it and requests are accepted.
create function public.is_library_active(lib uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.libraries l
    join public.subscriptions s on s.library_id = l.id
    where l.id = lib and l.approval_status = 'approved' and now() < s.active_until
  )
$$;

-- The profile may be edited while pending, rejected or active, but not once the plan has expired.
create function public.is_library_editable(lib uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.libraries l
    left join public.subscriptions s on s.library_id = l.id
    where l.id = lib
      and (l.approval_status <> 'approved' or coalesce(s.active_until, '-infinity'::timestamptz) > now())
  )
$$;

-- ---------------------------------------------------------------- least-privilege table grants
revoke all on all tables in schema public from anon, authenticated;

grant select on public.cities, public.areas to anon, authenticated;
grant select on public.profiles, public.libraries, public.shifts, public.subscriptions, public.seats,
               public.members, public.fee_payments, public.seat_requests, public.plan_payments
  to authenticated;

-- Admin-managed lists (the policies below limit these to admins).
grant insert, update on public.cities, public.areas to authenticated;

-- Profiles: a person may change only their own name and phone. Never the role.
grant update (name, phone) on public.profiles to authenticated;

-- Libraries: owners create them and edit descriptive fields. Status, owner, capacity and
-- rejection reason are changed only by functions.
grant insert (owner_id, name, city_id, area_id, address, landmark, pincode, phone, capacity, timings, amenities, photos)
  on public.libraries to authenticated;
grant update (name, city_id, area_id, address, landmark, pincode, phone, timings, amenities, photos)
  on public.libraries to authenticated;

-- Shifts: owners add and edit them. Shifts are never deleted (a trigger in 0002 blocks it).
grant insert (library_id, name, start_time, end_time, monthly_fee_paise, is_active) on public.shifts to authenticated;
grant update (name, start_time, end_time, monthly_fee_paise, is_active) on public.shifts to authenticated;

grant execute on function public.current_user_role(), public.is_admin(), public.is_library_owner(uuid),
                          public.is_library_active(uuid), public.is_library_editable(uuid)
  to anon, authenticated;

-- ---------------------------------------------------------------- profiles
alter table public.profiles
  add constraint profiles_phone_format check (phone = '' or phone ~ '^[6-9][0-9]{9}$');

create policy profiles_select_self_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Owners may see the name and phone of students who asked for a seat at their library.
create policy profiles_select_requesting_students on public.profiles
  for select to authenticated
  using (exists (
    select 1 from public.seat_requests r
    where r.student_id = profiles.id and public.is_library_owner(r.library_id)
  ));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Pick Student or Owner exactly once. Admin can only be set with SQL by the project owner.
create function public.set_my_role(new_role text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'insufficient_privilege';
  end if;
  if new_role not in ('student', 'owner') then
    raise exception 'Choose Student or Owner.' using errcode = 'invalid_parameter_value';
  end if;
  update public.profiles set role = new_role where id = auth.uid() and role is null;
  if not found then
    raise exception 'Your role is already set and cannot be changed.' using errcode = 'restrict_violation';
  end if;
end;
$$;
revoke all on function public.set_my_role(text) from public, anon;
grant execute on function public.set_my_role(text) to authenticated;

-- ---------------------------------------------------------------- cities and areas
create policy cities_select on public.cities
  for select to anon, authenticated using (is_active or public.is_admin());
create policy cities_admin_insert on public.cities
  for insert to authenticated with check (public.is_admin());
create policy cities_admin_update on public.cities
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy areas_select on public.areas
  for select to anon, authenticated using (is_active or public.is_admin());
create policy areas_admin_insert on public.areas
  for insert to authenticated with check (public.is_admin());
create policy areas_admin_update on public.areas
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------- libraries
create policy libraries_select_owner_or_admin on public.libraries
  for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());

create policy libraries_insert_owner on public.libraries
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.current_user_role() = 'owner'
    and approval_status = 'pending'
    and rejection_reason is null
  );

create policy libraries_update_owner on public.libraries
  for update to authenticated
  using (owner_id = auth.uid() and public.is_library_editable(id))
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------- shifts
create policy shifts_select_owner_or_admin on public.shifts
  for select to authenticated
  using (public.is_library_owner(library_id) or public.is_admin());

create policy shifts_insert_owner on public.shifts
  for insert to authenticated
  with check (public.is_library_owner(library_id) and public.is_library_editable(library_id));

create policy shifts_update_owner on public.shifts
  for update to authenticated
  using (public.is_library_owner(library_id) and public.is_library_editable(library_id))
  with check (public.is_library_owner(library_id));

-- Do the minutes overlap? Handles a shift that runs past midnight. Touching ends do not overlap.
create function public.shift_overlaps(s1 time, e1 time, s2 time, e2 time)
returns boolean
language plpgsql immutable
as $$
declare
  a_s integer := extract(hour from s1) * 60 + extract(minute from s1);
  a_e integer := extract(hour from e1) * 60 + extract(minute from e1);
  b_s integer := extract(hour from s2) * 60 + extract(minute from s2);
  b_e integer := extract(hour from e2) * 60 + extract(minute from e2);
begin
  if a_e <= a_s then a_e := a_e + 1440; end if;
  if b_e <= b_s then b_e := b_e + 1440; end if;
  return (a_s < b_e - 1440 and b_s - 1440 < a_e)
      or (a_s < b_e and b_s < a_e)
      or (a_s < b_e + 1440 and b_s + 1440 < a_e);
end;
$$;

-- At most 3 active shifts, no overlaps between active shifts, and at least one stays on.
create function public.enforce_shift_rules()
returns trigger
language plpgsql
as $$
declare
  other_active integer;
  clash text;
begin
  if new.is_active then
    select count(*) into other_active
    from public.shifts where library_id = new.library_id and is_active and id <> new.id;
    if other_active >= 3 then
      raise exception 'A library can run up to 3 shifts. Switch one off first.' using errcode = 'check_violation';
    end if;

    select s.name into clash
    from public.shifts s
    where s.library_id = new.library_id and s.is_active and s.id <> new.id
      and public.shift_overlaps(new.start_time, new.end_time, s.start_time, s.end_time)
    limit 1;
    if clash is not null then
      raise exception '% overlaps %. Shifts cannot share time.', new.name, clash using errcode = 'exclusion_violation';
    end if;
  elsif tg_op = 'UPDATE' and old.is_active then
    if not exists (
      select 1 from public.shifts where library_id = new.library_id and is_active and id <> new.id
    ) then
      raise exception 'Keep at least one shift on.' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create trigger shifts_enforce_rules
  before insert or update on public.shifts
  for each row execute function public.enforce_shift_rules();

-- ---------------------------------------------------------------- read-only tables (writes arrive via functions in 0004)
create policy subscriptions_select on public.subscriptions
  for select to authenticated
  using (public.is_library_owner(library_id) or public.is_admin());

create policy seats_select on public.seats
  for select to authenticated
  using (public.is_library_owner(library_id) or public.is_admin());

create policy members_select on public.members
  for select to authenticated
  using (public.is_library_owner(library_id) or student_id = auth.uid() or public.is_admin());

create policy fee_payments_select on public.fee_payments
  for select to authenticated
  using (
    public.is_library_owner(library_id)
    or public.is_admin()
    or exists (select 1 from public.members m where m.id = fee_payments.member_id and m.student_id = auth.uid())
  );

create policy seat_requests_select on public.seat_requests
  for select to authenticated
  using (student_id = auth.uid() or public.is_library_owner(library_id) or public.is_admin());

create policy plan_payments_select on public.plan_payments
  for select to authenticated
  using (public.is_library_owner(library_id) or public.is_admin());
