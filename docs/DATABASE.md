# StudySeat — Database

Supabase Postgres. All tables have Row Level Security (RLS) enabled. Business logic that changes plan dates, payment status, roles, or multiple rows at once lives in SQL functions.

## Conventions

- IDs: `uuid` (`gen_random_uuid()`).
- Money: integer paise, `check (amount_paise > 0)`.
- Plan times: `timestamptz`. Member dates: `date`.
- "Today" = `(now() at time zone 'Asia/Kolkata')::date`.
- No hard deletes on money or membership tables (no DELETE policies).

## Tables

### profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | references `auth.users(id)` |
| name | text | |
| phone | text | |
| role | text null | `student` \| `owner` \| `admin`; null until chosen |
| created_at | timestamptz | |

- Row created by trigger on `auth.users` insert.
- Column grants: `authenticated` may update only `name`, `phone`. `role` is set only by `set_my_role` (or SQL for admin).

### cities
`id`, `name` (unique), `is_active` (default true).

### areas
`id`, `city_id` → cities, `name`, `is_active`. `unique (city_id, name)`, `unique (id, city_id)` (for composite FK).

### libraries
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| owner_id | uuid unique | → profiles (one library per owner) |
| name | text | |
| city_id, area_id | uuid | FK `(area_id, city_id)` → `areas(id, city_id)` |
| address, landmark | text | |
| pincode | text | `check (pincode ~ '^[1-9][0-9]{5}$')` |
| phone | text | |
| capacity | int | `> 0` |
| monthly_fee_paise | int | `> 0` |
| timings | text | |
| amenities | text[] | values from a fixed list (check constraint) |
| photos | text[] | storage paths |
| approval_status | text | `pending` \| `approved` \| `rejected` |
| rejection_reason | text null | |
| created_at, updated_at | timestamptz | |

### subscriptions
`library_id` PK → libraries, `trial_ends_at` (display only), `active_until` (the only value rules check). Written only by functions.

### plan_payments
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| library_id | uuid | → libraries |
| amount_paise | int | default 19900, not writable by client |
| utr | text unique | |
| status | text | `pending` \| `verified` \| `failed` |
| failure_reason | text null | |
| submitted_at, verified_at | timestamptz | |
| verified_by | uuid null | → profiles |

### seats
`id`, `library_id`, `seat_number` int, `is_active` bool. `unique (library_id, seat_number)`, `unique (id, library_id)`.

### members
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| library_id | uuid | → libraries |
| student_id | uuid null | → profiles (set when created from a seat request) |
| name, phone | text | |
| seat_id | uuid null | FK `(seat_id, library_id)` → `seats(id, library_id)` |
| start_date, expiry_date | date | `expiry_date >= start_date`; expiry = "paid until" |
| status | text | `active` \| `removed` |
| removed_at | timestamptz null | |
| created_at | timestamptz | |

- `unique (seat_id) where status = 'active' and seat_id is not null` — one active member per seat.

### fee_payments
`id`, `member_id`, `amount_paise`, `paid_on` date, `mode` (`cash` \| `upi` \| `other`), `is_void` bool, `void_reason`, `created_at`. Voided only via `void_fee_payment`.

### seat_requests
`id`, `student_id`, `library_id`, `status` (`pending` \| `approved` \| `rejected` \| `cancelled`), `created_at`, `decided_at`.
- `unique (student_id, library_id) where status = 'pending'`.

## Functions

All are `security definer` with a fixed `search_path`, and each checks the caller first.

| Function | Caller | Behaviour |
|---|---|---|
| `is_admin()` | rules | caller's role is `admin` |
| `is_library_owner(library_id)` | rules | caller owns the library |
| `is_library_active(library_id)` | rules | approved and `now() < active_until` |
| `set_my_role(role)` | new user | `student`/`owner` only, only if role is null |
| `submit_library_for_review(library_id)` | owner | `rejected → pending` |
| `approve_library(library_id)` | admin | `pending → approved`; creates subscription with 14-day trial only if none exists |
| `reject_library(library_id, reason)` | admin | `pending → rejected` |
| `submit_plan_payment(library_id, utr)` | owner | inserts pending payment, amount 19900; allowed when expired |
| `verify_plan_payment(payment_id)` | admin | `select … for update`; must be pending; sets verified; `active_until = greatest(now(), active_until) + interval '30 days'` |
| `fail_plan_payment(payment_id, reason)` | admin | `pending → failed` |
| `set_capacity(library_id, capacity)` | owner, active | adds seats or deactivates free seats only |
| `renew_member(member_id, amount_paise, mode, new_expiry)` | owner, active | inserts fee + updates expiry atomically |
| `void_fee_payment(fee_id, reason)` | owner, active | marks void |
| `approve_seat_request(request_id, seat_id, start_date, expiry_date, amount_paise, mode)` | owner, active | creates member, assigns seat, optional fee, marks approved — atomically |
| `reject_seat_request(request_id)` | owner, active | `pending → rejected` |
| `public_libraries(city_id, area_id, max_fee_paise, amenities)` | anyone | active libraries + seats-left count; no member data |

## RLS summary

| Table | Read | Write |
|---|---|---|
| profiles | self; admin all | update `name`, `phone` on self |
| cities, areas | everyone (active); admin all | admin |
| libraries | owner own; everyone if active; admin all | owner insert own (pending); owner update own when pending/rejected/active; status fields via functions only |
| subscriptions | owner own; admin | functions only |
| plan_payments | owner own; admin | functions only |
| seats | owner own; everyone for active libraries | functions only |
| members | owner own library; student where `student_id = auth.uid()` | owner insert/update if owner and active |
| fee_payments | owner own library; student own | owner insert if owner and active; void via function |
| seat_requests | student own; owner of library | student insert if library active; student update own pending → cancelled; owner decisions via functions |

## Storage

Bucket `library-photos`, public read. Path `{library_id}/{filename}`. Insert/update/delete allowed only when `is_library_owner((storage.foldername(name))[1]::uuid)`.

## Testing RLS

The SQL editor runs as a superuser and bypasses RLS. Impersonate a user inside a transaction:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"<user-uuid>","role":"authenticated"}', true);
-- run the attempt here
rollback;
```

Must fail:
- Read or write another owner's library, seats, members, fees, payments.
- Update own `profiles.role`; call `set_my_role` a second time or with `admin`.
- Insert/update `subscriptions`; call `verify_plan_payment` as owner.
- Any write to an expired library (except `submit_plan_payment`).
- Two active members on one seat; reusing a UTR; a second pending request to the same library.

Must hold:
- Verifying the same payment twice adds 30 days once.
- Paying during the trial keeps remaining trial days; early renewal stacks.
- After `active_until` passes, the library is absent from `public_libraries`.
