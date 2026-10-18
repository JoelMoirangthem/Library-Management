# StudySeat — Requirements (v1)

Library owners manage their study library (seats, students, fees, expiry). Students find a library by city and area and request a seat. Owners get 14 days free, then ₹199/month to stay active and visible.

## Roles

| Role | Can do |
|---|---|
| Owner | Manage only their own library, seats, members, and fees |
| Student | Search active libraries, request a seat, view their own requests and membership |
| Admin | Approve/reject libraries, verify/fail ₹199 payments, manage cities and areas |

## Business rules (enforced in the database, never only in the UI)

- **BR-1** Library states: `pending` → `approved` or `rejected`. A rejected owner can edit and resubmit (back to `pending`).
- **BR-2** A library is *active* when it is `approved` and `now() < active_until`. Only active libraries are visible to students and can receive seat requests.
- **BR-3** The 14-day trial starts on the **first** approval only. Re-approval never resets it.
- **BR-4** A verified payment adds 30 days. Paid in advance (the plan still had days left on the date the UTR was submitted): the days left stay and 30 stack on top, so 3 days left becomes 33 days, even if the admin verifies after the plan has ended. Paid after the plan expired: 30 days from the day the admin verifies. Unused trial days count as days left.
- **BR-5** Plan amount is fixed by the database at 19900 paise. Each UTR can be used once. A payment moves `pending → verified | failed` exactly once.
- **BR-6** Expired library: owner can read everything; all writes to seats, members, fee payments, seat-request decisions, and the library profile are blocked. The only allowed write is submitting a plan payment.
- **BR-7** Users choose `student` or `owner` exactly once. The client can never change the role afterwards. `admin` is set only via SQL.
- **BR-8** One library per owner (v1).
- **BR-9** Money and membership records are never hard-deleted (fees are voided, members are removed, seats are deactivated).
- **BR-10** A seat can be held by at most one active member **per shift**. A seat stays occupied in a shift while its member is `active`, even past expiry, until the owner frees it.
- **BR-11** Member "expired" and "fee due" are derived from `expiry_date` vs today in `Asia/Kolkata`, never stored.
- **BR-12** A library runs 1 to 3 active **shifts** (defaults Morning 8:30 am to 12:30 pm, Afternoon 1 to 5 pm, Evening 6 to 9 pm; the owner edits names and times). Active shifts never overlap; a shift may cross midnight.
- **BR-13** Each shift has its own monthly fee, set by the owner. There is no library-wide fee.
- **BR-14** Shifts are never deleted. Switching one off hides it from new students; students already in it stay tagged to it and keep their seats. At least one shift stays on.
- **BR-15** A student who wants two shifts has two memberships (separate expiry and fees). The same person cannot be in the same shift twice. Seat requests are per shift.

## Features

### Auth (AUTH)
- **AUTH-1** Google login via Supabase Auth.
- **AUTH-2** Role chooser (Student / Owner) on first login; calls `set_my_role`.
- **AUTH-3** Route guards send each role to its home; unauthenticated users see only public pages.

### Public site (PUB)
- **PUB-1** Landing page: hero (Find a Library, List Your Library), how it works, owner pricing, FAQ, footer.
- **PUB-2** Privacy, Terms, Refund pages.

### Library profile (LIB)
- **LIB-1** Owner creates library: name, city, area, address, pincode, landmark, phone, capacity, monthly fee, timings, amenities (fixed list), photos.
- **LIB-2** On submit: status `pending`, message "In review, usually within 24 hours."
- **LIB-3** Owner sees rejection reason, edits, and resubmits.
- **LIB-4** Owner edits profile while pending, rejected, or active (BR-6).

### Admin (ADM)
- **ADM-1** Pending libraries list with Approve and Reject (reason required).
- **ADM-2** Payments list with Verify and Fail (reason required).
- **ADM-3** Manage cities and areas (add, activate/deactivate).

### Seats (SEAT)
- **SEAT-1** Seats generated from capacity on approval or setup.
- **SEAT-2** Increasing capacity adds seats; decreasing deactivates free seats only.
- **SEAT-3** Seat grid: free / occupied; tap to assign or free.

### Members (MEM)
- **MEM-1** Add member (name, phone, shift, seat free in that shift, start date, expiry date, optional first fee).
- **SHIFT-1** Owner defines up to 3 shifts with times and fees at setup, and can edit, switch off or switch on later.
- **SHIFT-2** Seats, Students, Requests and Dashboard are organised by shift; a full shift leaves the other shifts' seats free.
- **MEM-2** Edit, search, filter by expiring in 7 days / expired (due).
- **MEM-3** Renew: records fee and extends expiry in one atomic call.
- **MEM-4** Remove member (status `removed`, seat freed).

### Fees (FEE)
- **FEE-1** Record fee payment (amount, date, mode: cash/upi/other).
- **FEE-2** Void a fee payment with a reason; never delete.

### Dashboard (DASH)
- **DASH-1** Cards: total seats, occupied, available, active members.
- **DASH-2** Expiring in 7 days list; recent joins.
- **DASH-3** Numbers must match Seats and Members pages exactly.

### Plan and billing (PLAN)
- **PLAN-1** Trial/plan countdown banner on every owner page.
- **PLAN-2** Plan page: ₹199, UPI ID/QR, UTR field; submits via `submit_plan_payment`.
- **PLAN-3** Owner sees payment history with status and failure reason.
- **PLAN-4** Expired library: hidden from search, owner dashboard read-only (BR-6).

### Discovery (DISC)
- **DISC-1** City and area dropdowns; fee and amenity filters.
- **DISC-2** Library cards with "from ₹X" and seats left per shift (from `public_libraries`).
- **DISC-3** Detail page: photos, fees, timings, Call button, "Open in Google Maps" link from text address.

### Seat requests (REQ)
- **REQ-1** Student requests a seat in a chosen shift of an active library (one pending request per shift).
- **REQ-2** Student can cancel a pending request.
- **REQ-3** Owner approves (creates member + assigns seat + optional fee, atomically) or rejects.
- **REQ-4** Student sees My Requests and My Membership.

### UX (UX)
- **UX-1** Loading, empty, and error states on every screen (setting up / retry / not found).
- **UX-2** Mobile-first; bottom tab bar for owners.
- **UX-3** In-app banners: trial ending in 3 days, membership expiring.

## Out of scope (v1)

Maps/GPS, online student payments, payment gateway, reviews, WhatsApp, QR attendance, linking an existing offline member to a student account, partial fee payments, multiple libraries per owner.
