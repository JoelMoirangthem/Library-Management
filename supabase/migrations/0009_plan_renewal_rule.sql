-- StudySeat migration 0009: the owner's renewal rule (replaces the rule from 0008).
--   * Paid IN ADVANCE (plan still had days left when the UTR was submitted): the days left stay and
--     30 stack on top. Example: 3 days left + 30 = 33 days from the paid date. This holds even if the
--     admin only verifies after the plan has ended.
--   * Paid AFTER the plan expired: 30 days from the day the admin activates it (verifies the payment).
-- Verifying the same payment twice still adds nothing: the row is locked and must be pending.

create or replace function public.verify_plan_payment(p_payment uuid)
returns timestamptz
language plpgsql security definer set search_path = public
as $$
declare
  pay public.plan_payments;
  current_end timestamptz;
  base timestamptz;
  new_end timestamptz;
begin
  perform public.require_admin();
  select * into pay from public.plan_payments where id = p_payment for update;
  if not found then raise exception 'Payment not found.' using errcode = 'no_data_found'; end if;
  if pay.status <> 'pending' then
    raise exception 'This payment was already handled.' using errcode = 'restrict_violation';
  end if;

  select active_until into current_end from public.subscriptions where library_id = pay.library_id for update;

  if current_end is not null and current_end > pay.submitted_at then
    base := current_end;      -- paid in advance: stack on the days left
  else
    base := now();            -- paid after it ended: count from today's activation
  end if;
  new_end := base + interval '30 days';

  insert into public.subscriptions (library_id, trial_ends_at, active_until)
  values (pay.library_id, now(), new_end)
  on conflict (library_id) do update set active_until = excluded.active_until;

  update public.plan_payments
     set status = 'verified', verified_at = now(), verified_by = auth.uid()
   where id = p_payment;
  return new_end;
end;
$$;
