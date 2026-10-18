-- StudySeat migration 0004: library and plan-payment functions (part B1).
-- These are the ONLY way the browser can change approval status, plan dates, payments or seats.
-- Every function checks who is calling, does its whole job in one transaction, and gives a plain
-- sentence when it refuses. Part B2 (0005) adds students, fees and seat requests.

-- ---------------------------------------------------------------- shared guards
create function public.require_admin()
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can do this.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create function public.require_library_owner(lib uuid)
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_library_owner(lib) then
    raise exception 'This is not your library.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- ---------------------------------------------------------------- approval
-- Starts the 14-day trial on the FIRST approval only, and creates the seats.
create function public.approve_library(p_library uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  lib public.libraries;
begin
  perform public.require_admin();
  select * into lib from public.libraries where id = p_library for update;
  if not found then raise exception 'Library not found.' using errcode = 'no_data_found'; end if;
  if lib.approval_status <> 'pending' then
    raise exception 'Only a library waiting for review can be approved.' using errcode = 'restrict_violation';
  end if;
  if not exists (select 1 from public.shifts where library_id = p_library and is_active) then
    raise exception 'The owner has not set up any shift yet.' using errcode = 'restrict_violation';
  end if;

  update public.libraries set approval_status = 'approved', rejection_reason = null where id = p_library;

  insert into public.subscriptions (library_id, trial_ends_at, active_until)
  values (p_library, now() + interval '14 days', now() + interval '14 days')
  on conflict (library_id) do nothing;                                   -- never restart a trial

  if not exists (select 1 from public.seats where library_id = p_library) then
    insert into public.seats (library_id, seat_number)
    select p_library, g from generate_series(1, lib.capacity) g;
  end if;
end;
$$;

create function public.reject_library(p_library uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'Give a reason so the owner can fix it.' using errcode = 'invalid_parameter_value';
  end if;
  update public.libraries
     set approval_status = 'rejected', rejection_reason = btrim(p_reason)
   where id = p_library and approval_status = 'pending';
  if not found then
    raise exception 'Only a library waiting for review can be rejected.' using errcode = 'restrict_violation';
  end if;
end;
$$;

create function public.submit_library_for_review(p_library uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_library_owner(p_library);
  update public.libraries
     set approval_status = 'pending', rejection_reason = null
   where id = p_library and approval_status = 'rejected';
  if not found then
    raise exception 'Only a rejected library can be sent for review again.' using errcode = 'restrict_violation';
  end if;
end;
$$;

-- ---------------------------------------------------------------- seat count
-- Adds seats, or switches off FREE seats only (a seat with an active student in any shift stays).
create function public.set_library_capacity(p_library uuid, p_capacity integer)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  lib public.libraries;
  active_count integer;
  need integer;
  changed integer;
  top_number integer;
begin
  perform public.require_library_owner(p_library);
  if p_capacity is null or p_capacity < 1 or p_capacity > 500 then
    raise exception 'Seats must be a whole number between 1 and 500.' using errcode = 'invalid_parameter_value';
  end if;

  select * into lib from public.libraries where id = p_library for update;

  if lib.approval_status = 'approved' then
    if not public.is_library_active(p_library) then
      raise exception 'Your plan has expired. Renew to make changes.' using errcode = 'insufficient_privilege';
    end if;

    select count(*) into active_count from public.seats where library_id = p_library and is_active;

    if p_capacity > active_count then
      need := p_capacity - active_count;
      update public.seats set is_active = true
       where id in (select id from public.seats where library_id = p_library and not is_active order by seat_number limit need);
      get diagnostics changed = row_count;
      need := need - changed;
      if need > 0 then
        select coalesce(max(seat_number), 0) into top_number from public.seats where library_id = p_library;
        insert into public.seats (library_id, seat_number)
        select p_library, g from generate_series(top_number + 1, top_number + need) g;
      end if;
    elsif p_capacity < active_count then
      need := active_count - p_capacity;
      update public.seats set is_active = false
       where id in (
         select s.id from public.seats s
          where s.library_id = p_library and s.is_active
            and not exists (select 1 from public.members m where m.seat_id = s.id and m.status = 'active')
          order by s.seat_number desc
          limit need
       );
      get diagnostics changed = row_count;
      if changed < need then
        raise exception '% seats are in use. Free some seats first, or keep at least % seats.',
          need - changed, active_count - changed
          using errcode = 'restrict_violation';
      end if;
    end if;
  end if;

  update public.libraries set capacity = p_capacity where id = p_library;
end;
$$;

-- ---------------------------------------------------------------- plan payments
-- Allowed even when the plan has expired (otherwise the owner could never renew).
create function public.submit_plan_payment(p_library uuid, p_utr text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
  violated text;
begin
  perform public.require_library_owner(p_library);
  if not exists (select 1 from public.libraries where id = p_library and approval_status = 'approved') then
    raise exception 'You can pay once your library is approved.' using errcode = 'insufficient_privilege';
  end if;
  if p_utr is null or btrim(p_utr) !~ '^[0-9]{12}$' then
    raise exception 'The UTR is 12 digits. Check your UPI app.' using errcode = 'invalid_parameter_value';
  end if;

  begin
    insert into public.plan_payments (library_id, utr)             -- the amount is the table default, never from the browser
    values (p_library, btrim(p_utr))
    returning id into new_id;
  exception when unique_violation then
    get stacked diagnostics violated = constraint_name;
    if violated = 'plan_payments_utr_unique' then
      raise exception 'This UTR was already submitted.' using errcode = 'unique_violation';
    end if;
    raise exception 'A payment is already waiting to be checked.' using errcode = 'unique_violation';
  end;
  return new_id;
end;
$$;

-- Verifying twice must never add 60 days: the row is locked and must still be pending.
create function public.verify_plan_payment(p_payment uuid)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  pay public.plan_payments;
  current_end timestamptz;
  new_end timestamptz;
begin
  perform public.require_admin();
  select * into pay from public.plan_payments where id = p_payment for update;
  if not found then raise exception 'Payment not found.' using errcode = 'no_data_found'; end if;
  if pay.status <> 'pending' then
    raise exception 'This payment was already handled.' using errcode = 'restrict_violation';
  end if;

  select active_until into current_end from public.subscriptions where library_id = pay.library_id for update;
  new_end := greatest(now(), coalesce(current_end, now())) + interval '30 days';   -- keeps unused days, early renewal stacks

  insert into public.subscriptions (library_id, trial_ends_at, active_until)
  values (pay.library_id, now(), new_end)
  on conflict (library_id) do update set active_until = excluded.active_until;

  update public.plan_payments
     set status = 'verified', verified_at = now(), verified_by = auth.uid()
   where id = p_payment;
  return new_end;
end;
$$;

create function public.fail_plan_payment(p_payment uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  perform public.require_admin();
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'Give a reason so the owner knows what to fix.' using errcode = 'invalid_parameter_value';
  end if;
  update public.plan_payments
     set status = 'failed', failure_reason = btrim(p_reason)
   where id = p_payment and status = 'pending';
  if not found then
    raise exception 'This payment was already handled.' using errcode = 'restrict_violation';
  end if;
end;
$$;

-- ---------------------------------------------------------------- public search (no owner ids, no reasons)
create function public.public_libraries(
  p_city uuid default null,
  p_area uuid default null,
  p_max_fee_paise integer default null,
  p_amenities text[] default null
)
returns table (
  id uuid, name text, city_id uuid, city_name text, area_id uuid, area_name text,
  address text, pincode text, landmark text, phone text, timings text,
  amenities text[], photos text[], from_fee_paise integer, total_seats integer, shifts jsonb
)
language sql stable security definer set search_path = public
as $$
  select
    l.id, l.name, l.city_id, c.name, l.area_id, a.name,
    l.address, l.pincode, l.landmark, l.phone, l.timings,
    l.amenities, l.photos,
    (select min(sh.monthly_fee_paise) from public.shifts sh where sh.library_id = l.id and sh.is_active),
    (select count(*)::integer from public.seats s where s.library_id = l.id and s.is_active),
    coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', sh.id, 'name', sh.name,
               'start_time', to_char(sh.start_time, 'HH24:MI'), 'end_time', to_char(sh.end_time, 'HH24:MI'),
               'monthly_fee_paise', sh.monthly_fee_paise,
               'total_seats', (select count(*) from public.seats s where s.library_id = l.id and s.is_active),
               'seats_left', (select count(*) from public.seats s
                               where s.library_id = l.id and s.is_active
                                 and not exists (select 1 from public.members m
                                                  where m.seat_id = s.id and m.shift_id = sh.id and m.status = 'active'))
             ) order by sh.start_time)
        from public.shifts sh where sh.library_id = l.id and sh.is_active
    ), '[]'::jsonb)
  from public.libraries l
  join public.cities c on c.id = l.city_id and c.is_active
  join public.areas a on a.id = l.area_id and a.is_active
  where public.is_library_active(l.id)
    and (p_city is null or l.city_id = p_city)
    and (p_area is null or l.area_id = p_area)
    and (p_max_fee_paise is null or exists (
          select 1 from public.shifts sh where sh.library_id = l.id and sh.is_active and sh.monthly_fee_paise <= p_max_fee_paise))
    and (p_amenities is null or cardinality(p_amenities) = 0 or l.amenities @> p_amenities)
$$;

create function public.public_library(p_id uuid)
returns table (
  id uuid, name text, city_id uuid, city_name text, area_id uuid, area_name text,
  address text, pincode text, landmark text, phone text, timings text,
  amenities text[], photos text[], from_fee_paise integer, total_seats integer, shifts jsonb
)
language sql stable security definer set search_path = public
as $$ select * from public.public_libraries() p where p.id = p_id $$;

-- ---------------------------------------------------------------- who may call what
revoke all on function
  public.require_admin(), public.require_library_owner(uuid),
  public.approve_library(uuid), public.reject_library(uuid, text), public.submit_library_for_review(uuid),
  public.set_library_capacity(uuid, integer),
  public.submit_plan_payment(uuid, text), public.verify_plan_payment(uuid), public.fail_plan_payment(uuid, text),
  public.public_libraries(uuid, uuid, integer, text[]), public.public_library(uuid)
from public, anon, authenticated;

grant execute on function
  public.approve_library(uuid), public.reject_library(uuid, text), public.submit_library_for_review(uuid),
  public.set_library_capacity(uuid, integer),
  public.submit_plan_payment(uuid, text), public.verify_plan_payment(uuid), public.fail_plan_payment(uuid, text)
to authenticated;

grant execute on function public.public_libraries(uuid, uuid, integer, text[]), public.public_library(uuid)
to anon, authenticated;
