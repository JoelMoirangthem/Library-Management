-- StudySeat migration 0007: create a library and its shifts in one step.
-- The browser cannot insert a library and then its shifts separately: if the shifts were refused
-- (for example two of them overlap) the owner would be left with a library that has none.
-- This function does both inside one transaction, so it is all or nothing.

create function public.create_library(p_input jsonb, p_shifts jsonb)
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
      (owner_id, name, city_id, area_id, address, landmark, pincode, phone, capacity, timings, amenities, photos)
    values (
      auth.uid(),
      btrim(p_input ->> 'name'),
      (p_input ->> 'city_id')::uuid,
      (p_input ->> 'area_id')::uuid,
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
      raise exception 'The area must belong to the selected city.' using errcode = 'invalid_parameter_value';
    when check_violation or not_null_violation then
      raise exception 'Check the library details: name, address, a 6-digit pincode, a 10-digit phone and 1 to 500 seats.'
        using errcode = 'invalid_parameter_value';
  end;

  for s in select * from jsonb_array_elements(p_shifts) loop
    insert into public.shifts (library_id, name, start_time, end_time, monthly_fee_paise)
    values (new_id, btrim(s ->> 'name'), (s ->> 'start_time')::time, (s ->> 'end_time')::time, (s ->> 'monthly_fee_paise')::integer);
  end loop;

  return new_id;
end;
$$;

revoke all on function public.create_library(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_library(jsonb, jsonb) to authenticated;
