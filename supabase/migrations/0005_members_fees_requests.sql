-- StudySeat migration 0005: students, fees and seat requests (part B2).
-- Owners run the library through these functions; students request seats through them.
-- Every function checks who is calling, does its whole job in ONE transaction (so a failure
-- halfway leaves nothing behind) and refuses with a plain sentence. After this migration there
-- is nothing left that the browser has to write directly.

-- ---------------------------------------------------------------- shared guard
-- The caller owns the library AND the library is live (approved, inside its trial or paid period).
-- Expired owners can read everything but change nothing (the only exception is paying, see 0004).
create function public.require_active_owner(lib uuid)
returns void
language plpgsql stable security definer set search_path = public
as $$
begin
  perform public.require_library_owner(lib);
  if not exists (select 1 from public.libraries where id = lib and approval_status = 'approved') then
    raise exception 'Your library is not live yet.' using errcode = 'insufficient_privilege';
  end if;
  if not public.is_library_active(lib) then
    raise exception 'Your plan has expired. Renew to make changes.' using errcode = 'insufficient_privilege';
  end if;
end;
$$;

create function public.today_ist()
returns date
language sql stable
as $$ select (now() at time zone 'Asia/Kolkata')::date $$;

-- ---------------------------------------------------------------- members
create function public.add_member(
  p_library uuid, p_shift uuid, p_name text, p_phone text, p_seat uuid,
  p_start date, p_expiry date, p_fee_paise integer default null, p_fee_mode text default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
  sh public.shifts;
  seat_no integer;
  violated text;
begin
  perform public.require_active_owner(p_library);
  select * into sh from public.shifts where id = p_shift and library_id = p_library;
  if not found then raise exception 'Choose a shift.' using errcode = 'invalid_parameter_value'; end if;
  if not sh.is_active then
    raise exception '% is switched off for new students.', sh.name using errcode = 'invalid_parameter_value';
  end if;
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Enter the student''s name.' using errcode = 'invalid_parameter_value';
  end if;
  if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a 10-digit mobile number.' using errcode = 'invalid_parameter_value';
  end if;
  if p_start is null or p_expiry is null or p_expiry < p_start then
    raise exception 'Expiry must be on or after the start date.' using errcode = 'invalid_parameter_value';
  end if;
  if p_fee_paise is not null and (p_fee_paise <= 0 or p_fee_mode not in ('cash', 'upi', 'other')) then
    raise exception 'Enter the first payment amount and how it was paid.' using errcode = 'invalid_parameter_value';
  end if;
  if p_seat is not null then
    select seat_number into seat_no from public.seats where id = p_seat and library_id = p_library and is_active;
    if not found then raise exception 'That seat is not available.' using errcode = 'invalid_parameter_value'; end if;
  end if;

  begin
    insert into public.members (library_id, shift_id, name, phone, seat_id, start_date, expiry_date)
    values (p_library, p_shift, btrim(p_name), p_phone, p_seat, p_start, p_expiry)
    returning id into new_id;
  exception when unique_violation then
    get stacked diagnostics violated = constraint_name;
    if violated = 'members_one_active_per_seat_shift' then
      raise exception 'Seat % is already taken in %.', seat_no, sh.name using errcode = 'unique_violation';
    end if;
    raise exception 'This student is already in %. Add them to a different shift, or renew them.', sh.name
      using errcode = 'unique_violation';
  end;

  if p_fee_paise is not null then
    insert into public.fee_payments (member_id, library_id, amount_paise, paid_on, mode)
    values (new_id, p_library, p_fee_paise, public.today_ist(), p_fee_mode);
  end if;
  return new_id;
end;
$$;

create function public.update_member(p_member uuid, p_name text, p_phone text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  m public.members;
begin
  select * into m from public.members where id = p_member and public.is_library_owner(library_id) for update;
  if not found then raise exception 'Student not found.' using errcode = 'no_data_found'; end if;
  perform public.require_active_owner(m.library_id);
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Enter the student''s name.' using errcode = 'invalid_parameter_value';
  end if;
  if p_phone is null or p_phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Enter a 10-digit mobile number.' using errcode = 'invalid_parameter_value';
  end if;
  begin
    update public.members set name = btrim(p_name), phone = p_phone where id = p_member;
  exception when unique_violation then
    raise exception 'Another student in this shift already has that number.' using errcode = 'unique_violation';
  end;
end;
$$;

-- Marks the student removed and frees the seat. The record and its payments are kept.
create function public.remove_member(p_member uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  m public.members;
begin
  select * into m from public.members where id = p_member and public.is_library_owner(library_id) for update;
  if not found then raise exception 'Student not found.' using errcode = 'no_data_found'; end if;
  perform public.require_active_owner(m.library_id);
  if m.status = 'removed' then raise exception 'Already removed.' using errcode = 'restrict_violation'; end if;
  update public.members set status = 'removed', seat_id = null, removed_at = now() where id = p_member;
end;
$$;

-- Give a student a seat, move them, or free it (p_seat = null).
create function public.assign_member_seat(p_member uuid, p_seat uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  m public.members;
  seat_no integer;
  shift_name text;
begin
  select * into m from public.members where id = p_member and public.is_library_owner(library_id) for update;
  if not found then raise exception 'Student not found.' using errcode = 'no_data_found'; end if;
  perform public.require_active_owner(m.library_id);
  if m.status <> 'active' then raise exception 'This student was removed.' using errcode = 'restrict_violation'; end if;
  if p_seat is not null then
    select seat_number into seat_no from public.seats where id = p_seat and library_id = m.library_id and is_active;
    if not found then raise exception 'That seat is not available.' using errcode = 'invalid_parameter_value'; end if;
  end if;
  begin
    update public.members set seat_id = p_seat where id = p_member;
  exception when unique_violation then
    select name into shift_name from public.shifts where id = m.shift_id;
    raise exception 'Seat % is already taken in %.', seat_no, shift_name using errcode = 'unique_violation';
  end;
end;
$$;

-- Records the payment and extends the expiry together.
create function public.renew_member(p_member uuid, p_amount_paise integer, p_mode text, p_new_expiry date)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  m public.members;
begin
  select * into m from public.members where id = p_member and public.is_library_owner(library_id) for update;
  if not found then raise exception 'Student not found.' using errcode = 'no_data_found'; end if;
  perform public.require_active_owner(m.library_id);
  if m.status <> 'active' then raise exception 'This student was removed.' using errcode = 'restrict_violation'; end if;
  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'Fee must be more than zero.' using errcode = 'invalid_parameter_value';
  end if;
  if p_mode not in ('cash', 'upi', 'other') then
    raise exception 'Choose how it was paid.' using errcode = 'invalid_parameter_value';
  end if;
  if p_new_expiry is null or p_new_expiry <= m.expiry_date then
    raise exception 'New expiry must be after the current expiry.' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.fee_payments (member_id, library_id, amount_paise, paid_on, mode)
  values (p_member, m.library_id, p_amount_paise, public.today_ist(), p_mode);
  update public.members set expiry_date = p_new_expiry where id = p_member;
end;
$$;

-- ---------------------------------------------------------------- fees (voided, never deleted)
create function public.record_fee(p_member uuid, p_amount_paise integer, p_paid_on date, p_mode text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  m public.members;
  new_id uuid;
begin
  select * into m from public.members where id = p_member and public.is_library_owner(library_id);
  if not found then raise exception 'Student not found.' using errcode = 'no_data_found'; end if;
  perform public.require_active_owner(m.library_id);
  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'Fee must be more than zero.' using errcode = 'invalid_parameter_value';
  end if;
  if p_mode not in ('cash', 'upi', 'other') or p_paid_on is null then
    raise exception 'Enter the date and how it was paid.' using errcode = 'invalid_parameter_value';
  end if;
  insert into public.fee_payments (member_id, library_id, amount_paise, paid_on, mode)
  values (p_member, m.library_id, p_amount_paise, p_paid_on, p_mode)
  returning id into new_id;
  return new_id;
end;
$$;

create function public.void_fee(p_fee uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  f public.fee_payments;
begin
  select * into f from public.fee_payments where id = p_fee and public.is_library_owner(library_id) for update;
  if not found then raise exception 'Payment not found.' using errcode = 'no_data_found'; end if;
  perform public.require_active_owner(f.library_id);
  if f.is_void then raise exception 'Already voided.' using errcode = 'restrict_violation'; end if;
  if p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'Give a reason for voiding.' using errcode = 'invalid_parameter_value';
  end if;
  update public.fee_payments set is_void = true, void_reason = btrim(p_reason) where id = p_fee;
end;
$$;

-- ---------------------------------------------------------------- seat requests (per shift)
create function public.request_seat(p_library uuid, p_shift uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me public.profiles;
  sh public.shifts;
  new_id uuid;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found or me.role is distinct from 'student' then
    raise exception 'Only students can request a seat.' using errcode = 'insufficient_privilege';
  end if;
  if me.phone !~ '^[6-9][0-9]{9}$' then
    raise exception 'Add your mobile number first, so the library can call you.' using errcode = 'invalid_parameter_value';
  end if;
  if not public.is_library_active(p_library) then
    raise exception 'This library is not accepting requests.' using errcode = 'no_data_found';
  end if;
  select * into sh from public.shifts where id = p_shift and library_id = p_library;
  if not found then raise exception 'Choose a shift.' using errcode = 'invalid_parameter_value'; end if;
  if not sh.is_active then
    raise exception '% is switched off for new students.', sh.name using errcode = 'invalid_parameter_value';
  end if;
  if exists (select 1 from public.members where student_id = auth.uid() and shift_id = p_shift and status = 'active') then
    raise exception 'You are already a member of % here.', sh.name using errcode = 'unique_violation';
  end if;
  begin
    insert into public.seat_requests (student_id, library_id, shift_id)
    values (auth.uid(), p_library, p_shift)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'You already asked for a seat in %.', sh.name using errcode = 'unique_violation';
  end;
  return new_id;
end;
$$;

create function public.cancel_seat_request(p_request uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.seat_requests set status = 'cancelled', decided_at = now()
   where id = p_request and student_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Only a pending request can be cancelled.' using errcode = 'restrict_violation'; end if;
end;
$$;

-- Creates the member, assigns the seat, records the first payment and marks the request approved: all or nothing.
create function public.approve_seat_request(
  p_request uuid, p_seat uuid, p_start date, p_expiry date, p_amount_paise integer default 0, p_mode text default 'cash'
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  r public.seat_requests;
  who public.profiles;
  sh public.shifts;
  seat_no integer;
  new_id uuid;
begin
  select * into r from public.seat_requests where id = p_request and public.is_library_owner(library_id) for update;
  if not found then raise exception 'Request not found.' using errcode = 'no_data_found'; end if;
  perform public.require_active_owner(r.library_id);
  if r.status <> 'pending' then raise exception 'This request was already handled.' using errcode = 'restrict_violation'; end if;
  select * into sh from public.shifts where id = r.shift_id;
  if not sh.is_active then
    raise exception '% is switched off. Switch it on, or decline this request.', sh.name using errcode = 'restrict_violation';
  end if;
  if p_start is null or p_expiry is null or p_expiry < p_start then
    raise exception 'Expiry must be on or after the start date.' using errcode = 'invalid_parameter_value';
  end if;
  if p_amount_paise < 0 or (p_amount_paise > 0 and p_mode not in ('cash', 'upi', 'other')) then
    raise exception 'Check the first payment.' using errcode = 'invalid_parameter_value';
  end if;
  select seat_number into seat_no from public.seats where id = p_seat and library_id = r.library_id and is_active;
  if not found then raise exception 'That seat is not available.' using errcode = 'invalid_parameter_value'; end if;

  select * into who from public.profiles where id = r.student_id;
  begin
    insert into public.members (library_id, student_id, shift_id, name, phone, seat_id, start_date, expiry_date)
    values (r.library_id, r.student_id, r.shift_id, coalesce(nullif(btrim(who.name), ''), 'Student'), who.phone, p_seat, p_start, p_expiry)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'Seat % is already taken in %.', seat_no, sh.name using errcode = 'unique_violation';
  end;

  if p_amount_paise > 0 then
    insert into public.fee_payments (member_id, library_id, amount_paise, paid_on, mode)
    values (new_id, r.library_id, p_amount_paise, public.today_ist(), p_mode);
  end if;
  update public.seat_requests set status = 'approved', decided_at = now() where id = p_request;
  return new_id;
end;
$$;

create function public.reject_seat_request(p_request uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  r public.seat_requests;
begin
  select * into r from public.seat_requests where id = p_request and public.is_library_owner(library_id) for update;
  if not found then raise exception 'Request not found.' using errcode = 'no_data_found'; end if;
  perform public.require_active_owner(r.library_id);
  if r.status <> 'pending' then raise exception 'This request was already handled.' using errcode = 'restrict_violation'; end if;
  update public.seat_requests set status = 'rejected', decided_at = now() where id = p_request;
end;
$$;

-- ---------------------------------------------------------------- what a student sees (they cannot read libraries directly)
create function public.my_seat_requests()
returns table (
  id uuid, library_id uuid, library_name text, area_name text, city_name text,
  shift_id uuid, shift_name text, start_time text, end_time text,
  status text, created_at timestamptz, decided_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.library_id, l.name, a.name, c.name,
         r.shift_id, sh.name, to_char(sh.start_time, 'HH24:MI'), to_char(sh.end_time, 'HH24:MI'),
         r.status, r.created_at, r.decided_at
  from public.seat_requests r
  join public.libraries l on l.id = r.library_id
  join public.areas a on a.id = l.area_id
  join public.cities c on c.id = l.city_id
  join public.shifts sh on sh.id = r.shift_id
  where r.student_id = auth.uid()
  order by r.created_at desc
$$;

create function public.my_memberships()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_id', m.id,
    'library_id', l.id, 'library_name', l.name, 'library_phone', l.phone,
    'area_name', a.name, 'city_name', c.name, 'address', l.address,
    'shift_id', sh.id, 'shift_name', sh.name,
    'start_time', to_char(sh.start_time, 'HH24:MI'), 'end_time', to_char(sh.end_time, 'HH24:MI'),
    'seat_number', s.seat_number,
    'start_date', m.start_date, 'expiry_date', m.expiry_date,
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', f.id, 'amount_paise', f.amount_paise, 'paid_on', f.paid_on,
               'mode', f.mode, 'is_void', f.is_void, 'void_reason', f.void_reason) order by f.paid_on desc)
        from public.fee_payments f where f.member_id = m.id), '[]'::jsonb)
  ) order by l.name, sh.start_time), '[]'::jsonb)
  from public.members m
  join public.libraries l on l.id = m.library_id
  join public.areas a on a.id = l.area_id
  join public.cities c on c.id = l.city_id
  join public.shifts sh on sh.id = m.shift_id
  left join public.seats s on s.id = m.seat_id
  where m.student_id = auth.uid() and m.status = 'active'
$$;

-- ---------------------------------------------------------------- who may call what
revoke all on function
  public.require_active_owner(uuid), public.today_ist(),
  public.add_member(uuid, uuid, text, text, uuid, date, date, integer, text),
  public.update_member(uuid, text, text), public.remove_member(uuid), public.assign_member_seat(uuid, uuid),
  public.renew_member(uuid, integer, text, date),
  public.record_fee(uuid, integer, date, text), public.void_fee(uuid, text),
  public.request_seat(uuid, uuid), public.cancel_seat_request(uuid),
  public.approve_seat_request(uuid, uuid, date, date, integer, text), public.reject_seat_request(uuid),
  public.my_seat_requests(), public.my_memberships()
from public, anon, authenticated;

grant execute on function
  public.add_member(uuid, uuid, text, text, uuid, date, date, integer, text),
  public.update_member(uuid, text, text), public.remove_member(uuid), public.assign_member_seat(uuid, uuid),
  public.renew_member(uuid, integer, text, date),
  public.record_fee(uuid, integer, date, text), public.void_fee(uuid, text),
  public.request_seat(uuid, uuid), public.cancel_seat_request(uuid),
  public.approve_seat_request(uuid, uuid, date, date, integer, text), public.reject_seat_request(uuid),
  public.my_seat_requests(), public.my_memberships()
to authenticated;
