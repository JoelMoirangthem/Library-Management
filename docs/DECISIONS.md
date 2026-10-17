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

- **D-015 Light mode only in v1.** Components use semantic tokens (`bg-surface`, `text-ink-muted`), never raw hex, so dark mode stays possible. The default Tailwind palette is disabled in `src/index.css` so raw colours fail loudly.
- **D-016 Palette chosen by measured contrast.** Primary teal `#0F766E` (5.47:1 on white; the common `#0D9488` is 3.74:1 and fails). Accent orange `#C2410C` (5.18:1; `#EA580C` is 3.56:1). Orange is used rarely: Activate plan, trial ending. Form control edges use `border-strong` (`#78716C`, 4.8:1) because decorative `border` (`#E7E5E4`) is below the 3:1 needed for controls.
- **D-017 One font: Inter, self-hosted** via `@fontsource-variable/inter` (no Google Fonts request). Verified in the font file: `tnum` exists and digits 1 and 8 are both 1328 units wide when enabled. Apply `tabular-nums` on tables, prices, seat numbers, and stats, not on the whole body. The ₹ glyph lives in the latin-ext subset, which the browser loads on demand.
- **D-018 Seat state is never colour alone.** Each state has a second cue (fill shape, ring, clock dot, hatching). Seats are real `<button>`s with descriptive labels. Detailed in the SeatGrid component when built.
- **D-019 Non-happy-path screens share one component set:** `LoadingState`, `EmptyState`, `ErrorState` (retry), `NotFoundState`, `SetupState`, all built on `StateShell`. Error means "retry may work"; not found means "does not exist".
- **D-020 `/dev/styleguide` is development-only.** It sits behind `import.meta.env.DEV`; the production build contains neither the route nor its code (checked by searching `dist/`).
