-- StudySeat migration 0001: foundation tables.
-- Safe to read top to bottom. No payment, request or security-function logic here (see 0002 and 0003).
-- Row Level Security is switched ON for every table with NO policies yet, which means the
-- public API can read and write nothing until migration 0003 adds the policies.
-- Money is integer paise. Plan times are timestamptz. Nothing here hard-deletes records.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null default '',
  email       text not null default '',
  phone       text not null default '',
  -- null until the person picks Student or Owner (set once, by a function in 0003). Admin is set only by SQL.
  role        text check (role in ('student', 'owner', 'admin')),
  created_at  timestamptz not null default now()
);

-- Creates the profile row when someone first signs in.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- cities and areas
create table public.cities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true
);
create unique index cities_name_unique on public.cities (lower(name));

create table public.areas (
  id         uuid primary key default gen_random_uuid(),
  city_id    uuid not null references public.cities (id),
  name       text not null,
  is_active  boolean not null default true,
  unique (id, city_id)  -- lets libraries prove the area belongs to the chosen city
);
create unique index areas_city_name_unique on public.areas (city_id, lower(name));

-- ---------------------------------------------------------------- libraries
create table public.libraries (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null unique references public.profiles (id),  -- one library per owner (v1)
  name              text not null check (length(btrim(name)) > 0),
  city_id           uuid not null,
  area_id           uuid not null,
  address           text not null check (length(btrim(address)) > 0),
  landmark          text not null default '',
  pincode           text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  phone             text not null check (phone ~ '^[6-9][0-9]{9}$'),
  capacity          integer not null check (capacity between 1 and 500),
  timings           text not null default '',
  amenities         text[] not null default '{}',
  photos            text[] not null default '{}',
  approval_status   text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  rejection_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  foreign key (area_id, city_id) references public.areas (id, city_id)
);
create index libraries_city_area_idx on public.libraries (city_id, area_id);
create index libraries_status_idx on public.libraries (approval_status);

create function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger libraries_touch_updated_at
  before update on public.libraries
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- shifts (never deleted, only switched off)
create table public.shifts (
  id                 uuid primary key default gen_random_uuid(),
  library_id         uuid not null references public.libraries (id),
  name               text not null check (length(btrim(name)) > 0),
  start_time         time not null,
  end_time           time not null,                      -- may be earlier than start_time: runs past midnight
  monthly_fee_paise  integer not null check (monthly_fee_paise > 0),
  is_active          boolean not null default true,
  check (start_time <> end_time),
  unique (id, library_id)                                -- lets members/requests prove the shift belongs to the library
);
create unique index shifts_library_name_unique on public.shifts (library_id, lower(name));
create index shifts_library_idx on public.shifts (library_id);

-- ---------------------------------------------------------------- subscriptions
create table public.subscriptions (
  library_id      uuid primary key references public.libraries (id),
  trial_ends_at   timestamptz not null,                  -- display only
  active_until    timestamptz not null                   -- the only value the visibility rules check
);

-- ---------------------------------------------------------------- seats
create table public.seats (
  id           uuid primary key default gen_random_uuid(),
  library_id   uuid not null references public.libraries (id),
  seat_number  integer not null check (seat_number > 0),
  is_active    boolean not null default true,
  unique (library_id, seat_number),
  unique (id, library_id)
);

-- ---------------------------------------------------------------- lock everything until 0003 adds policies
alter table public.profiles       enable row level security;
alter table public.cities         enable row level security;
alter table public.areas          enable row level security;
alter table public.libraries      enable row level security;
alter table public.shifts         enable row level security;
alter table public.subscriptions  enable row level security;
alter table public.seats          enable row level security;
