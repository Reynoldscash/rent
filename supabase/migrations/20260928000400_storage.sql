-- =============================================================================
-- Easy Rent — 0004: storage buckets + policies
-- Source of truth: brain/rls-policies.md (STORAGE BUCKETS)
--
-- Path conventions:
--   listing-images/<listing_id>/<file>
--   avatars/<user_id>/<file>
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('listing-images', 'listing-images', true),
  ('avatars',        'avatars',        true)
on conflict (id) do nothing;

-- listing-images: public read, listing owner writes -----------------------------
create policy "listing-images: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'listing-images');

create policy "listing-images: owner uploads"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-images'
    and exists (
      select 1 from public.listings l
      where l.id::text = (storage.foldername(name))[1]
        and l.owner_id = auth.uid()
    )
  );

create policy "listing-images: owner updates"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-images'
    and exists (
      select 1 from public.listings l
      where l.id::text = (storage.foldername(name))[1]
        and l.owner_id = auth.uid()
    )
  );

create policy "listing-images: owner deletes"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-images'
    and exists (
      select 1 from public.listings l
      where l.id::text = (storage.foldername(name))[1]
        and l.owner_id = auth.uid()
    )
  );

-- avatars: public read, users write only their own folder ----------------------
create policy "avatars: public read"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'avatars');

create policy "avatars: user uploads own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: user updates own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars: user deletes own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
