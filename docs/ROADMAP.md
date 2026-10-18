# StudySeat — Roadmap (v1)

Finish and test each step, commit, then move on. "Done when" is the test script.

- [~] **Step 0 — Setup.** (scaffold, env loader, tests done; design foundation pending approval; Supabase project and Vercel account are yours to create) Node.js, Git, Supabase project, Vercel account. Vite + React + TypeScript + Tailwind + Vitest. `.env` with Supabase URL and anon key (git-ignored). Folder structure from `ARCHITECTURE.md`.
  *Done when:* app runs locally with a blank homepage; `.env` is not tracked.

- [ ] **Step 1 — Database and security.** Migrations for all tables, constraints, RLS, column grants, functions, storage policies (`DATABASE.md`). Seed cities and areas.
  *Done when:* every "must fail" / "must hold" test in `DATABASE.md` passes while impersonating real users.

- [ ] **Step 2 — Auth and roles.** Google login, role chooser via `set_my_role`, route guards, profile trigger. Make yourself admin with one SQL statement.
  *Done when:* a new user signs in, picks a role once, lands on the right home; changing role from the client fails.

- [ ] **Step 3 — Landing and legal pages.** Hero, how it works, pricing, FAQ, footer; Privacy, Terms, Refund.
  *Done when:* a visitor sees everything without logging in.

- [ ] **Step 4 — Owner onboarding and profile.** Library form; pending message; edit; rejected → see reason → resubmit.
  *Done when:* an owner creates, edits, and resubmits their library.

- [ ] **Step 5 — Admin approval.** Pending list, Approve (`approve_library`), Reject with reason.
  *Done when:* approval creates a 14-day trial once; re-approval does not reset it; rejection reason shows to the owner.

- [ ] **Step 6 — Seats, members, fees.** Seats from capacity (`set_capacity`); Members page (add, edit, search, filter expiring/expired, renew via `renew_member`, remove); Seat grid (assign/free); fee recording and void.
  *Done when:* an owner can run the library with no paper; one seat cannot hold two active members.

- [ ] **Step 7 — Owner dashboard.** Four cards, expiring in 7 days, recent joins.
  *Done when:* numbers match Seats and Members pages exactly.

- [ ] **Step 8 — Plan and billing.** Countdown banner; Plan page (₹199, UPI ID/QR, UTR via `submit_plan_payment`); payment history; admin Verify/Fail.
  *Done when:* verify adds 30 days once; trial days are kept; paying in advance stacks (3 days left becomes 33); paying after expiry counts 30 days from verification; expired library is hidden and read-only but can still submit a payment.

- [ ] **Step 9 — Student discovery.** City/area dropdowns, fee and amenity filters via `public_libraries`; detail page with photos, fees, timings, Call, Google Maps link.
  *Done when:* students see only active libraries, never expired/pending/rejected ones.

- [ ] **Step 10 — Seat requests and membership.** Request, cancel; owner approve (`approve_seat_request`) or reject; My Requests, My Membership.
  *Done when:* the full loop works from request to seat assignment; duplicate pending requests are blocked.

- [ ] **Step 11 — Polish and safety.** Loading/empty/error states everywhere; mobile-first; owner bottom tab bar; reminder banners.
  *Done when:* every screen works on a phone with no blank or broken states.

- [ ] **Step 12 — Deploy and pilot.** GitHub → Vercel, env vars, Google redirect URLs for the live domain, Supabase Pro before first paying owner. Onboard 10–20 libraries in one city.
  *Done when:* a real owner uses it for a week and gives feedback.

## Later (not v1)

Payment gateway (needs Supabase Edge Function + webhook), WhatsApp reminders (needs server), linking offline members to student accounts, partial fee payments, multiple libraries per owner, maps/GPS, reviews, QR attendance, phone OTP login.
