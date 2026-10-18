-- StudySeat migration 0008: plan days count from the date the owner PAID.
-- Before: the 30 days started when the admin pressed Verify, so an owner whose payment waited three
-- days for checking lost three days (and their library was hidden meanwhile).
-- Now: new end = the later of (the date the UTR was submitted, the current plan end) + 30 days.
--   * paid while days were left  -> those days stay and the 30 stack on top
--   * paid after the plan ended  -> 30 days from the paid date, not from the verification date
-- Verifying the same payment twice still adds nothing: the row is locked and must be pending.

create or replace function public.verify_plan_payment(p_payment uuid)
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
  new_end := greatest(pay.submitted_at, coalesce(current_end, pay.submitted_at)) + interval '30 days';

  insert into public.subscriptions (library_id, trial_ends_at, active_until)
  values (pay.library_id, pay.submitted_at, new_end)
  on conflict (library_id) do update set active_until = excluded.active_until;

  update public.plan_payments
     set status = 'verified', verified_at = now(), verified_by = auth.uid()
   where id = p_payment;
  return new_end;
end;
$$;
