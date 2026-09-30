-- =============================================================================
-- Easy Rent — 0008: renters keep seeing listings they booked
-- Inactive listings (and their photos) are visible to their owner and to any
-- renter with a booking on that listing; still hidden from everyone else.
-- Source: brain/rls-policies.md (LISTINGS, LISTING IMAGES)
--
-- The booking check lives in a SECURITY DEFINER helper: a subquery on
-- bookings directly inside the listings policy would make Postgres report
-- policy recursion (listings → profiles → listings) on listing inserts.
-- =============================================================================

create or replace function private.viewer_booked_listing(p_listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bookings
    where listing_id = p_listing_id and renter_id = auth.uid()
  );
$$;

revoke all on function private.viewer_booked_listing(uuid) from public;
grant execute on function private.viewer_booked_listing(uuid) to anon, authenticated, service_role;

create policy "listings: renters read listings they booked"
  on public.listings for select to authenticated
  using (private.viewer_booked_listing(id));

drop policy "listing_images: read for visible listings" on public.listing_images;

create policy "listing_images: read for visible listings"
  on public.listing_images for select to anon, authenticated
  using (exists (
    select 1 from public.listings l
    where l.id = listing_images.listing_id
      and (l.status = 'active' or l.owner_id = auth.uid() or private.viewer_booked_listing(l.id))
  ));
