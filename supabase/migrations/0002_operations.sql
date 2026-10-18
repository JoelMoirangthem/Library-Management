-- StudySeat migration 0002: operations tables.
-- Members (one row per student per shift), fee payments, seat requests and plan payments.
-- Key rules enforced by the database itself:
--   * a seat holds at most ONE active member per SHIFT (the same seat can serve different shifts)
--   * the same phone cannot be an active member of the same shift twice
--   * money and membership rows are never hard-deleted; fees are voided with a reason
--   * a plan payment's UTR is unique, and a library can have only one payment waiting at a time
-- Row Level Security is ON with no policies yet (see 0003), so the public API can touch nothing.

-- ---------------------------------------------------------------- members
create table public.members (
  id           uuid primary key default gen_random_uuid(),
  library_id   uuid not null references public.libraries (id),
  student_id   uuid references public.profiles (id),          -- set when created from a seat request
  shift_id     uuid not null,
  name         text not null check (length(btrim(name)) > 0),
  phone        text not null check (phone ~ '^[6-9][0-9]{9}$'),
  seat_id      uuid,
  start_date   date not null,
  expiry_date  date not null,                                  -- "paid until"
  status       text not null default 'active' check (status in ('active', 'removed')),
  removed_at   timestamptz,
  created_at   timestamptz not null default now(),
  check (expiry_date >= start_date),
  check (status = 'active' or seat_id is null),                -- removing a member frees the seat
  unique (id, library_id),
  foreign key (shift_id, library_id) references public.shifts (id, library_id),
  foreign key (seat_id, library_id) references public.seats (id, library_id)
);

-- One active member per seat per shift. This is the rule that stops double booking.
create unique index members_one_active_per_seat_shift
  on public.members (seat_id, shift_id)
  where status = 'active' and seat_id is not null;

-- The same person cannot be in the same shift twice (two shifts = two memberships).
create unique index members_one_active_per_phone_shift
  on public.members (library_id, shift_id, phone)
  where status = 'active';

create index members_library_idx on public.members (library_id);
create index members_student_idx on public.members (student_id) where student_id is not null;

-- ---------------------------------------------------------------- fee payments (voided, never deleted)
create table public.fee_payments (
  id            uuid primary key default gen_random_uuid(),
  member_id     uuid not null,
  library_id    uuid not null,
  amount_paise  integer not null check (amount_paise > 0),
  paid_on       date not null,
  mode          text not null check (mode in ('cash', 'upi', 'other')),
  is_void       boolean not null default false,
  void_reason   text,
  created_at    timestamptz not null default now(),
  check (is_void = false or (void_reason is not null and length(btrim(void_reason)) > 0)),
  foreign key (member_id, library_id) references public.members (id, library_id)
);
create index fee_payments_member_idx on public.fee_payments (member_id);
create index fee_payments_library_idx on public.fee_payments (library_id);

-- ---------------------------------------------------------------- seat requests (per shift)
create table public.seat_requests (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references public.profiles (id),
  library_id  uuid not null,
  shift_id    uuid not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  foreign key (shift_id, library_id) references public.shifts (id, library_id)
);
-- A student can have only one waiting request per shift (Morning and Evening can both be pending).
create unique index seat_requests_one_pending_per_shift
  on public.seat_requests (student_id, shift_id)
  where status = 'pending';
create index seat_requests_library_idx on public.seat_requests (library_id, status);
create index seat_requests_student_idx on public.seat_requests (student_id);

-- ---------------------------------------------------------------- plan payments (manual UPI, verified by an admin)
create table public.plan_payments (
  id              uuid primary key default gen_random_uuid(),
  library_id      uuid not null references public.libraries (id),
  amount_paise    integer not null default 19900 check (amount_paise > 0),  -- fixed by the database, never sent by the browser
  utr             text not null check (utr ~ '^[0-9]{12}$'),
  status          text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
  failure_reason  text,
  submitted_at    timestamptz not null default now(),
  verified_at     timestamptz,
  verified_by     uuid references public.profiles (id),
  check (status <> 'failed' or (failure_reason is not null and length(btrim(failure_reason)) > 0))
);
create unique index plan_payments_utr_unique on public.plan_payments (utr);
create unique index plan_payments_one_pending_per_library
  on public.plan_payments (library_id)
  where status = 'pending';
create index plan_payments_library_idx on public.plan_payments (library_id);

-- ---------------------------------------------------------------- never hard-delete records that matter
create function public.forbid_delete()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Deleting from % is not allowed. Mark the record removed, voided or switched off instead.', tg_table_name
    using errcode = 'restrict_violation';
end;
$$;

create trigger members_no_delete       before delete on public.members       for each row execute function public.forbid_delete();
create trigger fee_payments_no_delete  before delete on public.fee_payments  for each row execute function public.forbid_delete();
create trigger seat_requests_no_delete before delete on public.seat_requests for each row execute function public.forbid_delete();
create trigger plan_payments_no_delete before delete on public.plan_payments for each row execute function public.forbid_delete();
create trigger shifts_no_delete        before delete on public.shifts        for each row execute function public.forbid_delete();

-- A fee record's money fields are frozen after creation; only voiding it is allowed.
create function public.freeze_fee_payment()
returns trigger
language plpgsql
as $$
begin
  if new.member_id is distinct from old.member_id
     or new.library_id is distinct from old.library_id
     or new.amount_paise is distinct from old.amount_paise
     or new.paid_on is distinct from old.paid_on
     or new.mode is distinct from old.mode then
    raise exception 'A fee payment cannot be edited. Void it with a reason and record a new one.'
      using errcode = 'restrict_violation';
  end if;
  if old.is_void and not new.is_void then
    raise exception 'A voided fee payment cannot be restored.' using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger fee_payments_freeze
  before update on public.fee_payments
  for each row execute function public.freeze_fee_payment();

-- ---------------------------------------------------------------- lock until 0003 adds policies
alter table public.members        enable row level security;
alter table public.fee_payments   enable row level security;
alter table public.seat_requests  enable row level security;
alter table public.plan_payments  enable row level security;
