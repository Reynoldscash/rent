-- ============================
-- PROFILES
-- ============================
create table profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text not null,
  phone text not null,
  supplier_type text check (supplier_type in ('individual', 'business')),
  business_name text,
  badge text check (badge in ('standard', 'verified')) default 'standard',
  stripe_connect_id text,
  created_at timestamptz default now()
);

-- ============================
-- LISTINGS
-- ============================
create table listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  title text not null,
  description text not null,
  condition text not null,
  accessories text[] default '{}',
  pickup_instructions text not null,
  return_instructions text not null,
  safety_notes text,
  price_per_day numeric not null,
  deposit_amount numeric,
  photos text[] default '{}',
  created_at timestamptz default now()
);

-- ============================
-- BOOKINGS
-- ============================
create table bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id) on delete cascade,
  renter_id uuid references profiles(id) on delete cascade,
  owner_id uuid references profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  status text check (
    status in (
      'pending_approval',
      'approved',
      'pickup_confirmed',
      'active',
      'returned',
      'inspection_window',
      'claim_window',
      'completed',
      'cancelled'
    )
  ) not null,
  renter_fee numeric not null default 5,
  owner_commission_rate numeric not null default 0.12,
  cancellation_fee numeric,
  created_at timestamptz default now()
);

-- ============================
-- INSPECTIONS
-- ============================
create table inspections (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  type text check (type in ('before_pickup', 'after_return')) not null,
  photos text[] default '{}',
  notes text,
  accessories_present text[] default '{}',
  fuel_or_battery_level text,
  created_at timestamptz default now()
);

-- ============================
-- CLAIMS
-- ============================
create table claims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  owner_id uuid references profiles(id) on delete cascade,
  renter_id uuid references profiles(id) on delete cascade,
  description text not null,
  photos text[] default '{}',
  status text check (
    status in (
      'filed',
      'renter_accepted',
      'renter_disputed',
      'approved',
      'rejected',
      'closed'
    )
  ) not null,
  created_at timestamptz default now()
);

-- ============================
-- DEPOSITS & PAYOUTS
-- ============================
create table deposits_payouts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete cascade,
  deposit_amount numeric,
  deposit_status text check (deposit_status in ('held', 'released', 'applied')),
  payout_amount numeric not null,
  payout_status text check (payout_status in ('pending', 'paid')) not null,
  created_at timestamptz default now()
);

-- ============================
-- SUSPENSIONS
-- ============================
create table suspensions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  reason text not null,
  created_at timestamptz default now()
);

-- ============================
-- AUDIT LOGS
-- ============================
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  action text not null,
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);
