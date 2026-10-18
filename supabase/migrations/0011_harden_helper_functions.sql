-- StudySeat migration 0011: defence-in-depth hardening of helper / trigger / constraint functions.
--
-- Addresses two low-severity review findings. Neither was exploitable; this closes latent footguns
-- and makes the least-privilege story uniform with the rest of the schema.
--
-- S1 — helper, trigger and constraint functions were left without a fixed search_path (unlike the
--      business functions, which all set search_path). Fix: pin search_path = public on every one of
--      them as defence in depth against search_path tricks.
--
--      We deliberately do NOT revoke EXECUTE on these functions. shift_overlaps is called inside the
--      SECURITY INVOKER trigger enforce_shift_rules, and photos_are_valid is called by the
--      libraries_photos_valid CHECK constraint; both are evaluated with the invoking role's
--      privileges during owner shift / library writes. PostgreSQL checks the *caller's* EXECUTE right
--      before entering a function body, so revoking EXECUTE from `authenticated` would raise
--      "permission denied for function ..." and break those owner writes — and SECURITY DEFINER would
--      not help, because it only changes the body's privilege context, not the caller's EXECUTE
--      requirement. Both functions are pure, immutable, read no tables and only do time maths /
--      string matching on their arguments, so leaving direct EXECUTE in place is harmless.
--
-- S2 — libraries_update_owner had `with check (owner_id = auth.uid())` but USING also required
--      is_library_editable(id). The USING clause already blocks an expired library from being updated,
--      so this was not exploitable, but mirroring the editable check into WITH CHECK removes the
--      asymmetry (a future relaxation of USING cannot silently allow writes to an expired library).
--
-- Safe to run once on top of 0001..0010. No data is touched.

-- ---------------------------------------------------------------- S1: pin search_path on helper / trigger / constraint functions
alter function public.touch_updated_at() set search_path = public;
alter function public.forbid_delete() set search_path = public;
alter function public.freeze_fee_payment() set search_path = public;
alter function public.enforce_shift_rules() set search_path = public;
alter function public.shift_overlaps(time, time, time, time) set search_path = public;
alter function public.photos_are_valid(text[], uuid) set search_path = public;

-- ---------------------------------------------------------------- S2: mirror is_library_editable into the WITH CHECK
drop policy if exists libraries_update_owner on public.libraries;
create policy libraries_update_owner on public.libraries
  for update to authenticated
  using (owner_id = auth.uid() and public.is_library_editable(id))
  with check (owner_id = auth.uid() and public.is_library_editable(id));
