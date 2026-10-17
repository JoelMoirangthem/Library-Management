# StudySeat — Decisions

Newest at the bottom. Each entry: decision, reason.

- **D-001 No custom backend.** React on Vercel + Supabase. The database enforces all rules via RLS and functions, so a modified browser cannot cheat.
- **D-002 Manual UPI for the ₹199 plan.** Owner submits UTR, admin verifies. A gateway later needs an Edge Function and webhook.
- **D-003 Single `active_until` column.** `trial_ends_at` is kept for display only. Rules check `active_until`. Payments extend from `greatest(now(), active_until)`.
- **D-004 Trial starts on first approval only.** Re-approval never resets it.
- **D-005 Expired = read-only.** All owner writes blocked except `submit_plan_payment`. Nothing is deleted.
- **D-006 Role set once via `set_my_role`.** Column grants block client updates to `profiles.role`. Admin only via SQL.
- **D-007 One library per owner in v1.** `unique (owner_id)`.
- **D-008 Derived, not stored.** Seat occupancy from active members; member expired/due from `expiry_date` in Asia/Kolkata. No `fee_status` column.
- **D-009 Expired members keep their seat** until the owner removes them or frees the seat.
- **D-010 No partial fee payments in v1.** A renewal is one payment and one expiry extension.
- **D-011 Multi-row actions are SQL functions** (`approve_seat_request`, `renew_member`, `set_capacity`) so they succeed or fail as a whole.
- **D-012 Money in integer paise; no hard deletes** on money or membership records.
- **D-013 SOLID with plain TypeScript.** Pages → Hooks → Services → Repository interfaces; Supabase code only in `repositories/supabase` and `lib/supabase.ts`; wiring in `lib/container.ts`. No DI library.
- **D-014 RLS tested by impersonation**, because the SQL editor bypasses RLS.
