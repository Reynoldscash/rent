-- =============================================================================
-- Easy Rent — 0001: extensions, helpers, tables, constraints, indexes
-- Source of truth: brain/database-schema.md
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when the current statement comes from a browser client (anon /
-- authenticated). Triggers, SECURITY DEFINER functions, cron jobs and the
-- service role are "system" (see brain/database-schema.md).
create or replace function public.is_client()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('anon', 'authenticated');
$$;

-- Today's date in the marketplace time zone (America/Chicago).
create or replace function public.market_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'America/Chicago')::date;
$$;

-- Payment window after approval (booking-flow.md §3).
create or replace function public.payment_window()
returns interval
language sql
immutable
set search_path = ''
as $$
  select interval '24 hours';
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text,
  avatar_url  text,
  is_verified boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  slug       text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- listings
-- -----------------------------------------------------------------------------
create table public.listings (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid() references public.profiles (id),
  category_id   uuid references public.categories (id) on delete set null,
  title         text not null,
  description   text,
  price_per_day numeric(12, 2) not null check (price_per_day > 0),
  location      text,
  status        text not null default 'active' check (status in ('active', 'inactive')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index listings_owner_id_idx      on public.listings (owner_id);
create index listings_category_id_idx   on public.listings (category_id);
create index listings_price_per_day_idx on public.listings (price_per_day);
create index listings_location_idx      on public.listings (location);
create index listings_status_idx        on public.listings (status);

-- -----------------------------------------------------------------------------
-- listing_images
-- -----------------------------------------------------------------------------
create table public.listing_images (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  image_url  text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index listing_images_listing_id_idx on public.listing_images (listing_id);

-- -----------------------------------------------------------------------------
-- bookings
-- -----------------------------------------------------------------------------
create table public.bookings (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references public.listings (id),   -- no cascade: listings with bookings cannot be deleted
  renter_id   uuid not null default auth.uid() references public.profiles (id),
  owner_id    uuid not null references public.profiles (id),
  start_date  date not null,
  end_date    date not null,                                     -- exclusive
  status      text not null default 'pending'
              check (status in ('pending', 'approved', 'paid', 'rejected', 'cancelled', 'completed')),
  total_price numeric(12, 2) not null,
  approved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint bookings_dates_valid check (start_date < end_date),
  constraint bookings_not_own_listing check (renter_id <> owner_id)
);

create index bookings_listing_id_idx on public.bookings (listing_id);
create index bookings_renter_id_idx  on public.bookings (renter_id);
create index bookings_owner_id_idx   on public.bookings (owner_id);
create index bookings_status_idx     on public.bookings (status);

-- -----------------------------------------------------------------------------
-- availability_blocks
-- -----------------------------------------------------------------------------
create table public.availability_blocks (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  start_date date not null,
  end_date   date not null,                                      -- exclusive
  source     text not null default 'manual' check (source in ('booking', 'manual')),
  booking_id uuid unique references public.bookings (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_blocks_dates_valid check (start_date < end_date),
  constraint availability_blocks_source_booking check (
    (source = 'booking' and booking_id is not null)
    or (source = 'manual' and booking_id is null)
  ),
  -- No two blocks (manual or booking) on the same listing may overlap.
  constraint availability_blocks_no_overlap exclude using gist (
    listing_id with =,
    daterange(start_date, end_date, '[)') with &&
  )
);

-- -----------------------------------------------------------------------------
-- messages
-- -----------------------------------------------------------------------------
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  sender_id  uuid not null default auth.uid() references public.profiles (id),
  content    text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index messages_booking_id_created_at_idx on public.messages (booking_id, created_at);

-- -----------------------------------------------------------------------------
-- reviews
-- -----------------------------------------------------------------------------
create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings (id),
  listing_id uuid not null references public.listings (id),
  renter_id  uuid not null default auth.uid() references public.profiles (id),
  rating     integer not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviews_listing_id_idx on public.reviews (listing_id);

-- -----------------------------------------------------------------------------
-- owner_bans
-- -----------------------------------------------------------------------------
create table public.owner_bans (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references public.profiles (id),
  banned_user_id uuid not null references public.profiles (id),
  reason         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint owner_bans_unique unique (owner_id, banned_user_id),
  constraint owner_bans_not_self check (owner_id <> banned_user_id)
);

-- -----------------------------------------------------------------------------
-- payments
-- -----------------------------------------------------------------------------
create table public.payments (
  id                    uuid primary key default gen_random_uuid(),
  booking_id            uuid not null references public.bookings (id),
  stripe_session_id     text not null unique,
  stripe_payment_intent text,
  amount_cents          integer not null check (amount_cents > 0),
  currency              text not null default 'USD' check (currency = 'USD'),
  status                text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  needs_refund          boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index payments_booking_id_idx on public.payments (booking_id);
create index payments_needs_refund_idx on public.payments (needs_refund) where needs_refund;

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'categories', 'listings', 'listing_images', 'bookings',
    'availability_blocks', 'messages', 'reviews', 'owner_bans', 'payments'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;
