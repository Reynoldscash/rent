-- =============================================================================
-- Easy Rent — 0003: table privileges + Row Level Security
-- Source of truth: brain/rls-policies.md
--
-- Two layers:
--   1. Column-level GRANTs decide which columns a client may write at all
--      (Supabase grants ALL by default, so we revoke first).
--   2. RLS policies decide which rows.
-- Triggers (0002) then force system-controlled fields and validate transitions.
-- =============================================================================

revoke all on
  public.profiles, public.categories, public.listings, public.listing_images,
  public.bookings, public.availability_blocks, public.messages, public.reviews,
  public.owner_bans, public.payments,
  public.public_reviews, public.listing_ratings, public.owner_ratings
from anon, authenticated;

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.listings            enable row level security;
alter table public.listing_images      enable row level security;
alter table public.bookings            enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.messages            enable row level security;
alter table public.reviews             enable row level security;
alter table public.owner_bans          enable row level security;
alter table public.payments            enable row level security;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
grant select on public.profiles to anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

create policy "profiles: read own"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "profiles: read owners of active listings"
  on public.profiles for select to anon, authenticated
  using (exists (
    select 1 from public.listings l
    where l.owner_id = profiles.id and l.status = 'active'
  ));

create policy "profiles: read booking counterparts"
  on public.profiles for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where (b.renter_id = auth.uid() and b.owner_id = profiles.id)
       or (b.owner_id = auth.uid() and b.renter_id = profiles.id)
  ));

create policy "profiles: update own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- -----------------------------------------------------------------------------
-- categories (read-only for clients)
-- -----------------------------------------------------------------------------
grant select on public.categories to anon, authenticated;

create policy "categories: public read"
  on public.categories for select to anon, authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- listings
-- -----------------------------------------------------------------------------
grant select on public.listings to anon, authenticated;
grant insert (category_id, title, description, price_per_day, location, status)
  on public.listings to authenticated;
grant update (category_id, title, description, price_per_day, location, status)
  on public.listings to authenticated;
grant delete on public.listings to authenticated;

create policy "listings: read active"
  on public.listings for select to anon, authenticated
  using (status = 'active');

create policy "listings: owner reads own"
  on public.listings for select to authenticated
  using (owner_id = auth.uid());

create policy "listings: verified users create"
  on public.listings for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_verified)
  );

create policy "listings: owner updates"
  on public.listings for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "listings: owner deletes when no bookings"
  on public.listings for delete to authenticated
  using (
    owner_id = auth.uid()
    and not exists (select 1 from public.bookings b where b.listing_id = listings.id)
  );

-- -----------------------------------------------------------------------------
-- listing_images
-- -----------------------------------------------------------------------------
grant select on public.listing_images to anon, authenticated;
grant insert (listing_id, image_url) on public.listing_images to authenticated;
grant update (image_url) on public.listing_images to authenticated;
grant delete on public.listing_images to authenticated;

create policy "listing_images: read for visible listings"
  on public.listing_images for select to anon, authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id
      and (l.status = 'active' or l.owner_id = auth.uid())
  ));

create policy "listing_images: owner inserts"
  on public.listing_images for insert to authenticated
  with check (exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id and l.owner_id = auth.uid()
  ));

create policy "listing_images: owner updates"
  on public.listing_images for update to authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id and l.owner_id = auth.uid()
  ));

create policy "listing_images: owner deletes"
  on public.listing_images for delete to authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id and l.owner_id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- availability_blocks
--   owner: manual blocks only; system: booking blocks
-- -----------------------------------------------------------------------------
grant select on public.availability_blocks to anon, authenticated;
grant insert (listing_id, start_date, end_date) on public.availability_blocks to authenticated;  -- source defaults to 'manual'
grant delete on public.availability_blocks to authenticated;

create policy "availability_blocks: read for visible listings"
  on public.availability_blocks for select to anon, authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = availability_blocks.listing_id
      and (l.status = 'active' or l.owner_id = auth.uid())
  ));

create policy "availability_blocks: owner adds manual"
  on public.availability_blocks for insert to authenticated
  with check (
    source = 'manual'
    and booking_id is null
    and exists (
      select 1 from public.listings l
      where l.id = availability_blocks.listing_id and l.owner_id = auth.uid()
    )
  );

create policy "availability_blocks: owner removes manual"
  on public.availability_blocks for delete to authenticated
  using (
    source = 'manual'
    and exists (
      select 1 from public.listings l
      where l.id = availability_blocks.listing_id and l.owner_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- bookings
-- -----------------------------------------------------------------------------
grant select on public.bookings to authenticated;
grant insert (listing_id, start_date, end_date) on public.bookings to authenticated;
grant update (status) on public.bookings to authenticated;

create policy "bookings: participants read"
  on public.bookings for select to authenticated
  using (renter_id = auth.uid() or owner_id = auth.uid());

create policy "bookings: renter requests"
  on public.bookings for insert to authenticated
  with check (renter_id = auth.uid());

-- Which status moves are allowed is enforced by public.bookings_before_update().
create policy "bookings: participants update status"
  on public.bookings for update to authenticated
  using (renter_id = auth.uid() or owner_id = auth.uid())
  with check (renter_id = auth.uid() or owner_id = auth.uid());

-- -----------------------------------------------------------------------------
-- messages
-- -----------------------------------------------------------------------------
grant select on public.messages to authenticated;
grant insert (booking_id, content) on public.messages to authenticated;

create policy "messages: participants read"
  on public.messages for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = messages.booking_id
      and (b.renter_id = auth.uid() or b.owner_id = auth.uid())
  ));

-- Verification / ban / status checks: public.messages_before_insert()
create policy "messages: participants send"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.id = messages.booking_id
        and (b.renter_id = auth.uid() or b.owner_id = auth.uid())
    )
  );

-- -----------------------------------------------------------------------------
-- reviews (public read goes through the public_reviews view)
-- -----------------------------------------------------------------------------
grant select on public.reviews to authenticated;
grant insert (booking_id, rating, comment) on public.reviews to authenticated;

create policy "reviews: renter reads own"
  on public.reviews for select to authenticated
  using (renter_id = auth.uid());

-- Completed-booking check: public.reviews_before_insert()
create policy "reviews: renter creates"
  on public.reviews for insert to authenticated
  with check (renter_id = auth.uid());

grant select on public.public_reviews, public.listing_ratings, public.owner_ratings
  to anon, authenticated;

-- -----------------------------------------------------------------------------
-- owner_bans (never visible to the banned user)
-- -----------------------------------------------------------------------------
grant select on public.owner_bans to authenticated;
grant insert (banned_user_id, reason) on public.owner_bans to authenticated;
grant delete on public.owner_bans to authenticated;

create policy "owner_bans: owner reads"
  on public.owner_bans for select to authenticated
  using (owner_id = auth.uid());

create policy "owner_bans: owner bans after a booking"
  on public.owner_bans for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.bookings b
      where b.owner_id = auth.uid() and b.renter_id = owner_bans.banned_user_id
    )
  );

create policy "owner_bans: owner removes"
  on public.owner_bans for delete to authenticated
  using (owner_id = auth.uid());

-- -----------------------------------------------------------------------------
-- payments (writes: system only)
-- -----------------------------------------------------------------------------
grant select on public.payments to authenticated;

create policy "payments: participants read"
  on public.payments for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = payments.booking_id
      and (b.renter_id = auth.uid() or b.owner_id = auth.uid())
  ));

-- -----------------------------------------------------------------------------
-- Realtime: messages and booking status updates (system-overview.md §5)
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.bookings;
  end if;
end;
$$;
