-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
alter table profiles enable row level security;
alter table listings enable row level security;
alter table bookings enable row level security;
alter table inspections enable row level security;
alter table claims enable row level security;
alter table deposits_payouts enable row level security;
alter table suspensions enable row level security;
alter table audit_logs enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================

-- Users can read their own profile
create policy "read own profile"
on profiles for select
using (id = auth.uid());

-- Users can update their own profile
create policy "update own profile"
on profiles for update
using (id = auth.uid());

-- Admins can read all profiles
create policy "admin read profiles"
on profiles for select
using (auth.role() = 'service_role');

-- Admins can update any profile (for badge, suspension, claim resolution)
create policy "admin update profiles"
on profiles for update
using (auth.role() = 'service_role');

-- ============================================================
-- LISTINGS
-- ============================================================

-- Anyone can read listings
create policy "public read listings"
on listings for select
using (true);

-- Owners can insert listings
create policy "owners insert listings"
on listings for insert
with check (owner_id = auth.uid());

-- Owners can update their own listings
create policy "owners update listings"
on listings for update
using (owner_id = auth.uid());

-- ============================================================
-- BOOKINGS
-- ============================================================

-- Renter or owner can read bookings they are involved in
create policy "read own bookings"
on bookings for select
using (
  renter_id = auth.uid()
  or owner_id = auth.uid()
);

-- Renter can create bookings
create policy "renter creates bookings"
on bookings for insert
with check (renter_id = auth.uid());

-- Owner can update booking status ONLY for their own listings
create policy "owner updates booking status"
on bookings for update
using (owner_id = auth.uid());

-- Renter can cancel their own booking
create policy "renter cancels booking"
on bookings for update
using (renter_id = auth.uid());

-- Admin can read/update all bookings
create policy "admin manage bookings"
on bookings for all
using (auth.role() = 'service_role');

-- ============================================================
-- INSPECTIONS
-- ============================================================

-- Renter or owner can read inspections for their booking
create policy "read inspections for own booking"
on inspections for select
using (
  exists (
    select 1 from bookings
    where bookings.id = inspections.booking_id
    and (bookings.renter_id = auth.uid() or bookings.owner_id = auth.uid())
  )
);

-- Owner or renter can insert inspections for their booking
create policy "insert inspections for own booking"
on inspections for insert
with check (
  exists (
    select 1 from bookings
    where bookings.id = inspections.booking_id
    and (bookings.renter_id = auth.uid() or bookings.owner_id = auth.uid())
  )
);

-- No one except admin can update inspections
create policy "admin update inspections"
on inspections for update
using (auth.role() = 'service_role');

-- ============================================================
-- CLAIMS
-- ============================================================

-- Owner or renter can read claims for their booking
create policy "read own claims"
on claims for select
using (
  owner_id = auth.uid()
  or renter_id = auth.uid()
);

-- Owner can file claims
create policy "owner files claims"
on claims for insert
with check (owner_id = auth.uid());

-- Renter can accept or dispute claims
create policy "renter responds to claims"
on claims for update
using (renter_id = auth.uid());

-- Admin resolves claims
create policy "admin resolves claims"
on claims for update
using (auth.role() = 'service_role');

-- ============================================================
-- DEPOSITS & PAYOUTS
-- ============================================================

-- Renter or owner can read deposit/payout info for their booking
create policy "read own deposit payout"
on deposits_payouts for select
using (
  exists (
    select 1 from bookings
    where bookings.id = deposits_payouts.booking_id
    and (bookings.renter_id = auth.uid() or bookings.owner_id = auth.uid())
  )
);

-- Only admin can update deposit/payout records
create policy "admin updates deposit payout"
on deposits_payouts for update
using (auth.role() = 'service_role');

-- ============================================================
-- SUSPENSIONS
-- ============================================================

-- Admin can read suspensions
create policy "admin read suspensions"
on suspensions for select
using (auth.role() = 'service_role');

-- Admin can insert suspensions
create policy "admin insert suspensions"
on suspensions for insert
with check (auth.role() = 'service_role');

-- ============================================================
-- AUDIT LOGS
-- ============================================================

-- Admin can read audit logs
create policy "admin read audit logs"
on audit_logs for select
using (auth.role() = 'service_role');

-- Admin can insert audit logs
create policy "admin insert audit logs"
on audit_logs for insert
with check (auth.role() = 'service_role');
