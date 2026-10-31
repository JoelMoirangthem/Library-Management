-- NearMe Library migration 0016: the owner types the area by hand (D-045).
--
-- WHY: an owner knows the name of their locality better than our list does, and a missing area was a dead end when
-- listing a library. The area is now plain text on the library, optional, and nobody has to maintain a list for it.
--
-- WHAT CHANGES
--   1. libraries.area (text, may be empty) holds what the owner typed. Every library gets the name of the area it had
--      (libraries.area_id), so nothing students see today changes. It is stored tidied: no spaces at either end, no double
--      spaces, at most 60 characters. The database enforces this (libraries_area_tidy); the app tidies before it saves.
--   2. create_library, public_libraries, public_library, my_seat_requests and my_memberships read libraries.area.
--      A switched-off area in the admin list no longer hides libraries: libraries do not point at that list any more.
--   3. public_libraries filters by area NAME (p_area text), ignoring case and extra spaces.
--   4. area_names(city) lists the area names for the area filter on Discover: the admin's active areas for the town plus
--      the areas typed by libraries students can find, once each. Names only, so strangers may run it.
--
-- WHAT STAYS (on purpose)
--   libraries.area_id, its foreign key and its column grants stay, so the website that is live today keeps saving while
--   this is rolled out. area_id is emptied here: otherwise the old (area_id, city_id) foreign key would refuse a library
--   whose town is changed, because the old area belongs to the old town. A later migration drops the column once the new
--   website is live. The areas table also stays: it feeds area_names.
--   To go back, map names to the admin list again:
--     update public.libraries l set area_id = a.id from public.areas a
--      where a.city_id = l.city_id and lower(a.name) = lower(l.area);
--
-- ROLL-OUT: take a backup first (npm run db:query -- "select to_jsonb(t) from public.libraries t order by 1::text"), run
-- npm run db:push, then deploy the website. Between the two, the OLD website still shows correct area names, but its
-- area dropdown on Discover finds nothing and an area an owner picks in the old form is not saved.

-- ---------------------------------------------------------------- the new column
alter table public.libraries add column area text not null default '';

-- Keep what students see today: copy each library's area name, tidied and cut to 60 characters.
update public.libraries l
   set area = btrim(left(btrim(regexp_replace(a.name, '\s+', ' ', 'g')), 60))
  from public.areas a
 where a.id = l.area_id;

-- The old link is empty from now on (the names are copied above).
update public.libraries set area_id = null where area_id is not null;

alter table public.libraries
  add constraint libraries_area_tidy
  check (area = btrim(regexp_replace(area, '\s+', ' ', 'g')) and char_length(area) <= 60);

-- Owners write the area on their own library like the other descriptive columns (the row rules of 0003 and 0011 still apply).
grant insert (area) on public.libraries to authenticated;
grant update (area) on public.libraries to authenticated;

-- ---------------------------------------------------------------- create a library (replaces 0015)
create or replace function public.create_library(p_input jsonb, p_shifts jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  new_id uuid;
  s jsonb;
  shift_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = 'insufficient_privilege';
  end if;
  if public.current_user_role() is distinct from 'owner' then
    raise exception 'Only owners can list a library.' using errcode = 'insufficient_privilege';
  end if;
  shift_count := coalesce(jsonb_array_length(p_shifts), 0);
  if shift_count < 1 or shift_count > 3 then
    raise exception 'Set up between 1 and 3 shifts.' using errcode = 'invalid_parameter_value';
  end if;

  begin
    insert into public.libraries
      (owner_id, name, state_id, district_id, city_id, area, address, landmark, pincode, phone, capacity, timings, amenities, photos)
    values (
      auth.uid(),
      btrim(p_input ->> 'name'),
      (p_input ->> 'state_id')::uuid,
      (p_input ->> 'district_id')::uuid,
      (p_input ->> 'city_id')::uuid,
      btrim(regexp_replace(coalesce(p_input ->> 'area', ''), '\s+', ' ', 'g')),
      btrim(p_input ->> 'address'),
      coalesce(btrim(p_input ->> 'landmark'), ''),
      btrim(p_input ->> 'pincode'),
      btrim(p_input ->> 'phone'),
      (p_input ->> 'capacity')::integer,
      coalesce(btrim(p_input ->> 'timings'), ''),
      array(select jsonb_array_elements_text(coalesce(p_input -> 'amenities', '[]'::jsonb))),
      array(select jsonb_array_elements_text(coalesce(p_input -> 'photos', '[]'::jsonb)))
    )
    returning id into new_id;
  exception
    when unique_violation then
      raise exception 'You already have a library.' using errcode = 'unique_violation';
    when foreign_key_violation then
      raise exception 'Pick the district from the chosen state and the city from that district.'
        using errcode = 'invalid_parameter_value';
    when check_violation or not_null_violation then
      raise exception 'Check the library details: state, district, city, name, address, an area of up to 60 characters, a 6-digit pincode, a 10-digit phone and 1 to 500 seats.'
        using errcode = 'invalid_parameter_value';
  end;

  for s in select * from jsonb_array_elements(p_shifts) loop
    insert into public.shifts (library_id, name, start_time, end_time, monthly_fee_paise)
    values (new_id, btrim(s ->> 'name'), (s ->> 'start_time')::time, (s ->> 'end_time')::time, (s ->> 'monthly_fee_paise')::integer);
  end loop;

  return new_id;
end;
$$;

-- ---------------------------------------------------------------- public search (replaces 0015): filter by area NAME
drop function public.public_library(uuid);
drop function public.public_libraries(uuid, uuid, uuid, uuid, integer, text[]);

create function public.public_libraries(
  p_state uuid default null,
  p_district uuid default null,
  p_city uuid default null,
  p_area text default null,
  p_max_fee_paise integer default null,
  p_amenities text[] default null
)
returns table (
  id uuid, name text,
  state_id uuid, state_name text, district_id uuid, district_name text,
  city_id uuid, city_name text, area_name text,
  address text, pincode text, landmark text, phone text, timings text,
  amenities text[], photos text[], from_fee_paise integer, total_seats integer, shifts jsonb
)
language sql stable security definer set search_path = public
as $$
  select
    l.id, l.name,
    l.state_id, st.name, l.district_id, d.name,
    l.city_id, c.name, l.area,
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
  join public.states st on st.id = l.state_id
  join public.districts d on d.id = l.district_id
  join public.cities c on c.id = l.city_id and c.is_active
  where public.is_library_active(l.id)
    and (p_state is null or l.state_id = p_state)
    and (p_district is null or l.district_id = p_district)
    and (p_city is null or l.city_id = p_city)
    and (btrim(coalesce(p_area, '')) = ''
         or lower(l.area) = lower(btrim(regexp_replace(p_area, '\s+', ' ', 'g'))))
    and (p_max_fee_paise is null or exists (
          select 1 from public.shifts sh where sh.library_id = l.id and sh.is_active and sh.monthly_fee_paise <= p_max_fee_paise))
    and (p_amenities is null or cardinality(p_amenities) = 0 or l.amenities @> p_amenities)
$$;

create function public.public_library(p_id uuid)
returns table (
  id uuid, name text,
  state_id uuid, state_name text, district_id uuid, district_name text,
  city_id uuid, city_name text, area_name text,
  address text, pincode text, landmark text, phone text, timings text,
  amenities text[], photos text[], from_fee_paise integer, total_seats integer, shifts jsonb
)
language sql stable security definer set search_path = public
as $$ select * from public.public_libraries() p where p.id = p_id $$;

-- ---------------------------------------------------------------- the area list on Discover
-- Admin areas win the spelling; otherwise the first in A-Z order. Only libraries students can find add their area.
create function public.area_names(p_city uuid)
returns table (name text)
language sql stable security definer set search_path = public
as $$
  select distinct on (lower(n.area_name)) n.area_name
    from (
      select btrim(regexp_replace(a.name, '\s+', ' ', 'g')) as area_name, 0 as source
        from public.areas a
       where a.city_id = p_city and a.is_active
      union all
      select l.area, 1
        from public.libraries l
       where l.city_id = p_city and l.area <> '' and public.is_library_active(l.id)
    ) n
   where n.area_name <> ''
   order by lower(n.area_name), n.source, n.area_name
$$;

-- ---------------------------------------------------------------- what a student sees (replaces 0015)
create or replace function public.my_seat_requests()
returns table (
  id uuid, library_id uuid, library_name text, area_name text, city_name text,
  shift_id uuid, shift_name text, start_time text, end_time text,
  status text, created_at timestamptz, decided_at timestamptz,
  state_id uuid, district_id uuid, city_id uuid
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.library_id, l.name, l.area, c.name,
         r.shift_id, sh.name, to_char(sh.start_time, 'HH24:MI'), to_char(sh.end_time, 'HH24:MI'),
         r.status, r.created_at, r.decided_at,
         l.state_id, l.district_id, l.city_id
  from public.seat_requests r
  join public.libraries l on l.id = r.library_id
  join public.cities c on c.id = l.city_id
  join public.shifts sh on sh.id = r.shift_id
  where r.student_id = auth.uid()
  order by r.created_at desc
$$;

create or replace function public.my_memberships()
returns jsonb
language sql stable security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_id', m.id,
    'library_id', l.id, 'library_name', l.name, 'library_phone', l.phone,
    'area_name', l.area, 'city_name', c.name, 'district_name', d.name, 'state_name', st.name,
    'address', l.address,
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
  join public.cities c on c.id = l.city_id
  join public.districts d on d.id = l.district_id
  join public.states st on st.id = l.state_id
  join public.shifts sh on sh.id = m.shift_id
  left join public.seats s on s.id = m.seat_id
  where m.student_id = auth.uid() and m.status = 'active'
$$;

-- ---------------------------------------------------------------- who may call what
-- The new functions start open to everyone (Postgres default); close them, then open exactly what is needed.
revoke all on function
  public.public_libraries(uuid, uuid, uuid, text, integer, text[]), public.public_library(uuid), public.area_names(uuid)
from public, anon, authenticated;

grant execute on function
  public.public_libraries(uuid, uuid, uuid, text, integer, text[]), public.public_library(uuid), public.area_names(uuid)
to anon, authenticated;
